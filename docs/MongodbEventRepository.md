# MongodbEventRepository

- [MongodbEventRepository](#mongodbeventrepository)
  - [Sessions](#sessions)

Data repository made for MongoDB databases. This repository **must** be extended by another class implementing its own methods. The base abstract class must have some properties when instantiated such as:

- Must receive the `Collection` object from Mongodb

> **Note:** The `collection` **OBJECT**, not the collection **NAME**

- Must receive the main entity constructor (not the instance)

By default, the class already has some base methods:

- `save (entity: TEntity, force: Boolean = false)`: Which will serialize and save the received entity (which must be of the same type you passed to the generic type `TEntity` in `MongodbEventRepository<TEntity>`) on the database.

> This method works by firstly trying to find the entity by its ID, if the ID cannot be found in the database, then a new document will be created, following the `{_id, events, state}` format where `events` should start as an empty array and, by default, at each `save`, the `pendingEvents` array will be merged to it; the `force` option, explained below, changes this saving behaviour. Soon after that, the `confirmEvents` method will be called, thus clearing the `pendingEvents` array.

> The `force` option changes the behaviour stated above. When this flag is set to `true`, the repository will not append the `pendingEvents` array to the end of the database `events` array. Instead, it'll override the whole saved events array; so be  **_really_** careful when using this option. For instance, misusing this could lead to data loss on concurrent write scenarios. Consider this as rewriting the history of a git repository with a `push --force`: it's there, it can be done, but, in most situations, you really shouldn't.

> `state` will be the last reduced state of the entity, which will be obtained by calling the `state` getter we just defined earlier.

- `findById (id: ObjectId)`: Will search in the database for a record with the informed `id`.

> This record should be created when the class is instantiated using the `create` method

- `existBy (query: { [key: string]: any })`: Returns a boolean value to check if an object exists using a given query
- `bulkUpdate (entities: IEventEntity[])`: Save events from several instances of an existing entity at once
- `bulkInsert (entities: IEventEntity[])`: Save events from several instances of an non existing entity at once
- `withSession (session: ClientSession)`: Begins a MongoDB session to initiate a transaction (only on Mongo 4.0) and returns an object with the available methods which can be executed within a session. If this following command throws an error, the whole session suffers a rollback, otherwise it is commited.
- `_runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [key: string]: 1|-1 } = {})`: Executes a query aplying pagination to the result. Returns an object that follows the [IPaginatedQueryResult](#ipaginatedqueryresult) interface.

> **Note:** `_runPaginatedQuery` should only be used **inside** the child class because it'll return a collection of **documents** and not a collection of **entities**. This harms the principle for entity-first design this repository is all about. In order to create a useful method, please refer to the example below on how to create a `search` method using `_runPaginatedQuery` properly

## Sessions

If your MongoDB version is 4.0 or higher (with transaction support), in order to execute a command using a transaction, follow this example:

```ts
import { Db, MongoClient } from 'mongodb'
import { MongodbEventRepository } from '@irontitan/paradox'
import { Person } from './classes/Person'

class PersonRepository extends MongodbEventRepository<Person> {
  constructor(connection: Db) {
    super(connection.collection(Person.collection), Person)
  }

  async search (filters: { name: string }, page: number = 1, size: number = 50) {
    const query = filters.name
      ? { 'state.name': filters.name }
      : { }

    const { documents, count, range, total } = await this._runPaginatedQuery(query, page, size)
    const entities = documents.map(({ events }) => new Person().setPersistedEvents(events))

    return { entities, count, range, total }
  }
}

(async function () {
  const personData = { email:'johndoe@doe.com', password:'jdoe' }
  const connection = (await MongoClient.connect('mongodb://mongodburl')).db('crowd')

  const personRepository = new PersonRepository(connection)
  const existPerson = await personRepository.existBy({ email: emailpersonData.email }) // Returns boolean
  if (!existPerson) {
    const johnDoe = Person.create(personData.email, personData.password)
    await personRepository.save(johnDoe) // Creates a new event
  }

  const allJanes = await personRepository.search({ name: 'jane' }, 1, 10) // Returns an object following IPaginatedQueryResult interface

  johnDoe.changeEmail({ newEmail: 'johndoe@company.com' }, 'jdoe')
  const [ janeDoe ] = allJanes
  janeDoe.changeEmail({ newEmail: 'janedoe@doe.com' }, 'janedoe')

  const session = connection.startSession()
  await personRepository.withSession(session).bulkUpdate([ johnDoe, janeDoe ]) // Updates both entities using a transaction
})()
```

> If you version does **not** support transactions, an Database Error is thrown

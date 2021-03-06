import { IEventEntity } from '../interfaces/IEventEntity'
import { IEvent, Reducer, ICommitFunction } from '@irontitan/tardis'

export abstract class EventEntity<TEntity> implements IEventEntity {
  persistedEvents: IEvent<any>[] = []
  pendingEvents: IEvent<any>[] = []
  id: any = null

  protected reducer: Reducer<TEntity>

  constructor (knownEvents: { [eventName: string]: ICommitFunction<TEntity, any> }) {
    this.reducer = new Reducer<TEntity>(knownEvents)
  }

  get state (): any {
    throw new Error('Method not implemented.')
  }

  private updateState () {
    const state = this.state

    for (const propertyName of Object.keys(state)) {
      (this as any)[propertyName] = state[propertyName]
    }
  }

  get events () {
    return [
      ...this.persistedEvents,
      ...this.pendingEvents
    ]
  }

  setPersistedEvents (events: IEvent<any>[]) {
    this.persistedEvents = events
    this.updateState()
    return this
  }

  pushNewEvents (events: IEvent<any>[]) {
    this.pendingEvents = this.pendingEvents.concat(events)
    this.updateState()
    return this
  }

  confirmEvents () {
    this.persistedEvents = this.persistedEvents.concat(this.pendingEvents)
    this.pendingEvents = []
    return this
  }
}

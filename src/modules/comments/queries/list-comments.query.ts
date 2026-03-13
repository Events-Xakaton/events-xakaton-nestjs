export class ListCommentsQuery {
  constructor(
    readonly entityType: 'club' | 'event',
    readonly entityId: string,
  ) {}
}

// Local stand-in for what `convex dev` generates, derived from the real
// schema so the types below are the true ones. Overwritten on first deploy.
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
} from 'convex/server'
import type { GenericId } from 'convex/values'
import schema from '../schema'

export type DataModel = DataModelFromSchemaDefinition<typeof schema>
export type TableNames = TableNamesInDataModel<DataModel>
export type Doc<T extends TableNames> = DocumentByName<DataModel, T>
export type Id<T extends TableNames> = GenericId<T>

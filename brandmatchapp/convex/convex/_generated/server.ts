// Local stand-in for what `convex dev` generates, bound to the real schema so
// ctx.db carries the true table and index types. Overwritten on first deploy.
import {
  actionGeneric,
  httpActionGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
  type ActionBuilder,
  type GenericActionCtx,
  type GenericMutationCtx,
  type GenericQueryCtx,
  type MutationBuilder,
  type QueryBuilder,
} from 'convex/server'
import type { DataModel } from './dataModel'

export const query = queryGeneric as QueryBuilder<DataModel, 'public'>
export const internalQuery = internalQueryGeneric as QueryBuilder<DataModel, 'internal'>
export const mutation = mutationGeneric as MutationBuilder<DataModel, 'public'>
export const internalMutation = internalMutationGeneric as MutationBuilder<DataModel, 'internal'>
export const action = actionGeneric as ActionBuilder<DataModel, 'public'>
export const internalAction = internalActionGeneric as ActionBuilder<DataModel, 'internal'>
export const httpAction = httpActionGeneric

export type QueryCtx = GenericQueryCtx<DataModel>
export type MutationCtx = GenericMutationCtx<DataModel>
export type ActionCtx = GenericActionCtx<DataModel>

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as campaigns from "../campaigns.js";
import type * as clientApi from "../clientApi.js";
import type * as crawl from "../crawl.js";
import type * as crons from "../crons.js";
import type * as deliver from "../deliver.js";
import type * as drafting from "../drafting.js";
import type * as evaluate from "../evaluate.js";
import type * as feasibility from "../feasibility.js";
import type * as gates from "../gates.js";
import type * as http from "../http.js";
import type * as httpUtil from "../httpUtil.js";
import type * as ingest from "../ingest.js";
import type * as jobs from "../jobs.js";
import type * as leads from "../leads.js";
import type * as ops from "../ops.js";
import type * as opsApi from "../opsApi.js";
import type * as quota from "../quota.js";
import type * as sourcing from "../sourcing.js";
import type * as templates from "../templates.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  campaigns: typeof campaigns;
  clientApi: typeof clientApi;
  crawl: typeof crawl;
  crons: typeof crons;
  deliver: typeof deliver;
  drafting: typeof drafting;
  evaluate: typeof evaluate;
  feasibility: typeof feasibility;
  gates: typeof gates;
  http: typeof http;
  httpUtil: typeof httpUtil;
  ingest: typeof ingest;
  jobs: typeof jobs;
  leads: typeof leads;
  ops: typeof ops;
  opsApi: typeof opsApi;
  quota: typeof quota;
  sourcing: typeof sourcing;
  templates: typeof templates;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

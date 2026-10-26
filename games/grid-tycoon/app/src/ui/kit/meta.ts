// Names, icons and hues for pools, links and building kinds, shared by every panel and chart so
// the same thing always reads the same way.

import type { BuildingKind, LinkUse, PoolId } from '../../engine'
import type { IconName } from './icons'

export interface PoolMeta {
  label: string
  short: string
  icon: IconName
  /** CSS colour (a palette token). */
  hue: string
  buys: 'power' | 'compute'
}

export const POOL_META: Record<PoolId, PoolMeta> = {
  citizens: { label: 'Citizens and government', short: 'Citizens', icon: 'town', hue: 'var(--town-mid)', buys: 'power' },
  otherDc: { label: 'Other datacenters', short: 'Other DCs', icon: 'rivals', hue: 'var(--grid-mid)', buys: 'power' },
  cloud: { label: 'Cloud', short: 'Cloud', icon: 'cloud', hue: 'var(--grid-light)', buys: 'compute' },
  btc: { label: 'Bitcoin mining', short: 'Bitcoin', icon: 'btc', hue: 'var(--power-dark)', buys: 'compute' },
  ai: { label: 'AI', short: 'AI', icon: 'ai', hue: 'var(--dc-mid)', buys: 'compute' },
}

export interface LinkMeta {
  label: string
  icon: IconName
  detail: string
}

export const LINK_META: Record<LinkUse, LinkMeta> = {
  internal: { label: 'Internal link', icon: 'link', detail: 'Your plants to your datacenters.' },
  town: { label: 'Town link', icon: 'town', detail: 'Your plants to citizens and government.' },
  import: { label: 'Import link', icon: 'bolt', detail: 'Rented MW into your datacenters.' },
}

export interface KindMeta {
  label: string
  plural: string
  icon: IconName
  hue: string
}

export const KIND_META: Record<BuildingKind, KindMeta> = {
  plant: { label: 'Plant', plural: 'Plants', icon: 'plant', hue: 'var(--plant-mid)' },
  dc: { label: 'Datacenter', plural: 'Datacenters', icon: 'dc', hue: 'var(--dc-mid)' },
}

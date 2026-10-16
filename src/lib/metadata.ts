export function pageMeta(title: string, description: string) {
  return { meta: [{ title: `${title} — Meal Planner` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — Meal Planner` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}
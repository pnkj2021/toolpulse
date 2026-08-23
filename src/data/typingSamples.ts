export const typingModes = ['words', 'javascript', 'json', 'sql', 'html-css'] as const;
export type TypingMode = (typeof typingModes)[number];

export const typingModeLabels: Record<TypingMode, string> = {
	words: 'Words',
	javascript: 'JavaScript',
	json: 'JSON',
	sql: 'SQL',
	'html-css': 'HTML/CSS',
};

export const typingSamples: Record<TypingMode, readonly string[]> = {
	words: [
		'Clear thinking turns complicated work into a sequence of small decisions. Read the problem carefully, test each assumption, and leave useful notes for the next person who opens the project.',
		'A reliable tool should feel quick, predictable, and easy to understand. Thoughtful labels, visible focus states, and helpful error messages make everyday tasks less frustrating.',
		'Practice rewards consistency more than speed. Relax your shoulders, keep a steady rhythm, and aim for accurate keystrokes before trying to move faster.',
	],
	javascript: [
		`async function loadProfile(userId) {
  const response = await fetchProfile(userId);
  if (!response.ok) throw new Error('Profile unavailable');
  return response.json();
}`,
		`const totals = orders.reduce((result, order) => {
  result.items += order.items.length;
  result.value += order.total;
  return result;
}, { items: 0, value: 0 });`,
		`export function debounce(callback, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}`,
	],
	json: [
		`{
  "project": "browser-tools",
  "version": 3,
  "features": ["fast", "private", "accessible"],
  "settings": { "theme": "system", "autosave": false }
}`,
		`{
  "user": { "id": 42, "name": "Avery", "active": true },
  "roles": ["editor", "reviewer"],
  "preferences": { "density": "compact", "hints": true }
}`,
		`{
  "build": { "target": "web", "minify": true },
  "checks": ["types", "tests", "lint"],
  "release": null,
  "retries": 2
}`,
	],
	sql: [
		`SELECT customer_id, COUNT(*) AS order_count
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY customer_id
ORDER BY order_count DESC;`,
		`WITH active_projects AS (
  SELECT id, owner_id, updated_at
  FROM projects
  WHERE archived_at IS NULL
)
SELECT owner_id, COUNT(*) AS total
FROM active_projects
GROUP BY owner_id;`,
		`UPDATE tasks
SET status = 'complete', completed_at = CURRENT_TIMESTAMP
WHERE project_id = 18
  AND status = 'in_progress'
  AND assignee_id IS NOT NULL;`,
	],
	'html-css': [
		`<article class="notice">
  <h2>Build complete</h2>
  <p>Your preview is ready to review.</p>
</article>

<style>
  .notice { padding: 1rem; border-radius: 0.75rem; }
</style>`,
		`<nav aria-label="Project">
  <a href="/overview/">Overview</a>
  <a href="/activity/">Activity</a>
</nav>

<style>
  nav { display: flex; gap: 1rem; }
</style>`,
		`<button class="save-button" type="button">
  Save changes
</button>

<style>
  .save-button:hover { transform: translateY(-1px); }
  .save-button:focus-visible { outline: 3px solid currentColor; }
</style>`,
	],
};

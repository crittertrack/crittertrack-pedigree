// Pure helpers for per-species care-checklist templates (no DB access, unit-testable).

const MAX_TEMPLATE_TASKS = 50;
const MAX_TASK_NAME = 80;
const MAX_TASK_NOTES = 300;

const normalizeName = (name) => String(name || '').trim().toLowerCase();

// Validates/cleans the tasks an admin submits. Returns { tasks } or { error }.
const sanitizeTemplateTasks = (input) => {
    if (!Array.isArray(input)) return { error: 'tasks must be an array.' };
    if (input.length > MAX_TEMPLATE_TASKS) return { error: `A template can have at most ${MAX_TEMPLATE_TASKS} tasks.` };
    const seen = new Set();
    const tasks = [];
    for (const raw of input) {
        const taskName = String(raw?.taskName || '').trim();
        if (!taskName) return { error: 'Every task needs a name.' };
        if (taskName.length > MAX_TASK_NAME) return { error: `Task names must be ${MAX_TASK_NAME} characters or fewer.` };
        const key = normalizeName(taskName);
        if (seen.has(key)) return { error: `Duplicate task: ${taskName}.` };
        seen.add(key);
        let frequencyDays = null;
        if (raw.frequencyDays !== null && raw.frequencyDays !== undefined && raw.frequencyDays !== '') {
            frequencyDays = Number(raw.frequencyDays);
            if (!Number.isInteger(frequencyDays) || frequencyDays < 1 || frequencyDays > 3650) {
                return { error: `"${taskName}": frequency must be a whole number of days between 1 and 3650.` };
            }
        }
        const notes = String(raw.notes || '').trim().slice(0, MAX_TASK_NOTES) || null;
        tasks.push({ taskName, frequencyDays, notes });
    }
    return { tasks };
};

// Builds the animalCareTasks entries to add: template tasks the animal doesn't already have (by
// name). Returns { toAdd, skipped }. Entries copy the template; later template edits never change them.
const mergeTemplateTasks = (existingTasks, templateTasks, makeId = defaultId) => {
    const have = new Set((existingTasks || []).map((t) => normalizeName(t?.taskName)));
    const toAdd = [];
    let skipped = 0;
    for (const t of templateTasks || []) {
        const key = normalizeName(t.taskName);
        if (!key || have.has(key)) { skipped++; continue; }
        have.add(key);
        toAdd.push({
            id: makeId(),
            taskName: t.taskName,
            notes: t.notes || null,
            frequencyDays: t.frequencyDays || null,
            lastDoneDate: null,
        });
    }
    return { toAdd, skipped };
};

function defaultId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { sanitizeTemplateTasks, mergeTemplateTasks, normalizeName, MAX_TEMPLATE_TASKS };

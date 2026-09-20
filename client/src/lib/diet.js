// Same maths as the server (server/src/routes/diet.js) so the form can preview results live.
export const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', hint: 'Desk or court work, little exercise' },
  light: { factor: 1.375, label: 'Lightly active', hint: 'Exercise 1–3 days a week' },
  moderate: { factor: 1.55, label: 'Moderately active', hint: 'Exercise 3–5 days a week' },
  active: { factor: 1.725, label: 'Very active', hint: 'Hard exercise 6–7 days a week' },
  athlete: { factor: 1.9, label: 'Athlete', hint: 'Twice-a-day training or physical job' },
};

export function computeDiet(p) {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  const bmr = Math.round(base + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78));
  const maintenance = Math.round(bmr * ACTIVITY[p.activity].factor);
  const delta = Math.round((p.weekly_rate * 7700) / 7);
  let target = p.goal === 'lose' ? maintenance - delta : p.goal === 'gain' ? maintenance + delta : maintenance;
  if (p.goal === 'lose') target = Math.max(target, p.sex === 'male' ? 1500 : 1200);
  target = Math.round(target / 10) * 10;
  return { bmr, maintenance, target };
}

export function weeksToGoal(p) {
  if (p.goal === 'maintain') return null;
  const diff = Math.abs(p.weight_kg - p.goal_weight_kg);
  if (!p.weekly_rate) return null;
  return Math.ceil(diff / p.weekly_rate);
}

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { id: 'lunch', label: 'Lunch', emoji: '🍛' },
  { id: 'snack', label: 'Snacks', emoji: '🥜' },
  { id: 'dinner', label: 'Dinner', emoji: '🌙' },
];

export const mealTypeNow = () => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner';
};

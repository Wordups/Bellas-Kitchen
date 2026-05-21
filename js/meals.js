// Meal templates — the 5 stations Bella's Kitchen serves.
// Each section: { key, title, icon, single?: bool, options: string[] }

export const meals = {
  sandwich: {
    name: "Sandwich Shop",
    emoji: "🥪",
    sections: [
      { key: 'bread',   title: 'Pick Your Bread', icon: '🍞', single: true,
        options: ['White', 'Wheat', 'Sourdough', 'Rye', 'Sub Roll', 'Wrap'] },
      { key: 'protein', title: 'Protein', icon: '🥩',
        options: ['Turkey', 'Ham', 'Roast Beef', 'Chicken', 'Tuna', 'PB&J'] },
      { key: 'cheese',  title: 'Cheese', icon: '🧀',
        options: ['American', 'Cheddar', 'Swiss', 'Provolone', 'Pepper Jack', 'None'] },
      { key: 'veggies', title: 'Veggies', icon: '🥬',
        options: ['Lettuce', 'Tomato', 'Onion', 'Pickles', 'Peppers', 'Cucumber'] },
      { key: 'sauces',  title: 'Sauces', icon: '🥫',
        options: ['Mayo', 'Mustard', 'Honey Mustard', 'Ranch', 'Hot Sauce', 'Oil & Vinegar'] },
      { key: 'sides',   title: 'On the Side', icon: '🍟',
        options: ['Chips', 'Pickle Spear', 'Fruit', 'Cookie'] },
      { key: 'drinks',  title: 'Drinks', icon: '🥤',
        options: ['Water', 'Juice', 'Milk', 'Soda', 'Lemonade', 'Sweet Tea'] },
    ],
  },

  taco: {
    name: "Taco Stand",
    emoji: "🌮",
    sections: [
      { key: 'shell',    title: 'Shell', icon: '🌮', single: true,
        options: ['Hard', 'Soft Flour', 'Soft Corn', 'Lettuce Wrap'] },
      { key: 'protein',  title: 'Protein', icon: '🥩',
        options: ['Ground Beef', 'Chicken', 'Carnitas', 'Shrimp', 'Beans', 'Fish'] },
      { key: 'toppings', title: 'Toppings', icon: '🥗',
        options: ['Cheese', 'Lettuce', 'Tomato', 'Onion', 'Cilantro', 'Jalapeño'] },
      { key: 'salsas',   title: 'Salsas', icon: '🌶️',
        options: ['Mild', 'Medium', 'Hot', 'Verde', 'Pico', 'Sour Cream', 'Guac'] },
      { key: 'sides',    title: 'Sides', icon: '🌽',
        options: ['Rice', 'Beans', 'Chips & Salsa', 'Elote'] },
    ],
  },

  breakfast: {
    name: "Breakfast Diner",
    emoji: "🍳",
    sections: [
      { key: 'eggs',   title: 'Eggs', icon: '🍳', single: true,
        options: ['Scrambled', 'Over Easy', 'Sunny Side', 'Hard Boiled', 'Omelette', 'No Eggs'] },
      { key: 'meat',   title: 'Meat', icon: '🥓',
        options: ['Bacon', 'Sausage', 'Ham', 'Turkey Bacon', 'None'] },
      { key: 'carb',   title: 'Carb', icon: '🥞',
        options: ['Toast', 'Pancakes', 'Waffles', 'Bagel', 'English Muffin', 'Hash Browns'] },
      { key: 'extras', title: 'Extras', icon: '🧈',
        options: ['Butter', 'Jelly', 'Syrup', 'Cheese', 'Fruit', 'Yogurt'] },
      { key: 'drinks', title: 'Drinks', icon: '☕',
        options: ['Coffee', 'Juice', 'Milk', 'Water', 'Hot Chocolate'] },
    ],
  },

  pizza: {
    name: "Pizza Parlor",
    emoji: "🍕",
    sections: [
      { key: 'crust',    title: 'Crust', icon: '🍕', single: true,
        options: ['Thin', 'Regular', 'Thick', 'Stuffed', 'Cauliflower', 'GF'] },
      { key: 'sauce',    title: 'Sauce', icon: '🍅', single: true,
        options: ['Red', 'White', 'BBQ', 'Pesto', 'No Sauce'] },
      { key: 'cheese',   title: 'Cheese', icon: '🧀',
        options: ['Mozzarella', 'Cheddar', 'Parmesan', 'Feta', 'Extra Cheese'] },
      { key: 'toppings', title: 'Toppings', icon: '🍄',
        options: ['Pepperoni', 'Sausage', 'Mushroom', 'Onion', 'Pepper', 'Olive', 'Pineapple', 'Ham'] },
      { key: 'sides',    title: 'Sides', icon: '🥤',
        options: ['Garlic Knots', 'Salad', 'Wings', 'Soda'] },
    ],
  },

  bowl: {
    name: "Build-a-Bowl",
    emoji: "🥗",
    sections: [
      { key: 'base',    title: 'Base', icon: '🍚', single: true,
        options: ['White Rice', 'Brown Rice', 'Quinoa', 'Greens', 'Noodles'] },
      { key: 'protein', title: 'Protein', icon: '🍗',
        options: ['Chicken', 'Beef', 'Tofu', 'Shrimp', 'Salmon', 'Egg'] },
      { key: 'veggies', title: 'Veggies', icon: '🥦',
        options: ['Broccoli', 'Carrot', 'Edamame', 'Cucumber', 'Avocado', 'Corn'] },
      { key: 'sauce',   title: 'Sauce', icon: '🥫', single: true,
        options: ['Teriyaki', 'Spicy Mayo', 'Soy', 'Sweet Chili', 'Peanut', 'Ranch'] },
      { key: 'crunch',  title: 'Crunch', icon: '🥜',
        options: ['Sesame', 'Crispy Onion', 'Peanuts', 'Wontons', 'None'] },
    ],
  },
};

export const mealList = () =>
  Object.entries(meals).map(([slug, m]) => ({ slug, name: m.name, emoji: m.emoji }));

export const getMeal = (slug) => meals[slug] || null;

// Render a one-line summary string from a selections object, for tickets/receipts.
export function summarize(slug, selections) {
  const meal = meals[slug];
  if (!meal) return '';
  const parts = [];
  for (const sec of meal.sections) {
    const v = selections[sec.key];
    if (!v) continue;
    const text = Array.isArray(v) ? v.join(', ') : v;
    if (text) parts.push(text);
  }
  return parts.join(' · ');
}

/* ==========================================================================
   Recipes: edit this file to fill in your recipes.

   Each recipe is one { ... } block. The Recipes page and each recipe's
   own page are built from this list, so there's nothing else to update.

     id          short name used in the link (recipe.html#glazed-plate).
                 Lowercase, no spaces, and different for every recipe.
     name        the recipe's title
     category    one of: "mains", "sides", "desserts", "breakfast"
     photo       a file in images/food, or "" to show a placeholder
     alt         a short description of the photo (for screen readers)
     ingredients one line per ingredient, in quotes, followed by a comma
     steps       optional: one line per step. Leave as [] to hide Steps.

   To add a recipe, copy a whole block (from { to },) and paste it below.
   To remove one, delete its whole block. The order here is the order
   on the page.
   ========================================================================== */

window.RECIPES = [
    {
        id: "glazed-plate",
        name: "Gochujang Chicken",
        category: "mains",
        photo: "glazed-plate.jpg",
        alt: "Pan Fry",
        ingredients: [
            "Chicken (breast or thigh)",
            "Gochujang",
            "Soy Sauce",
            "Honey",
            "Garlic",
        ],
        steps: [],
    },
    {
        id: "baked-bites",
        name: "Potato fish bites",
        category: "sides",
        photo: "baked-bites.jpg",
        alt: "Air Fry",
        ingredients: [
            "Fish paste",
            "Potato",
            "Butter",
            "Heavy Cream",
            "Salt",
            "Black Pepper",
        ],
        steps: [],
    },
    {
        id: "breadsticks",
        name: "Italian Grissini",
        category: "sides",
        photo: "breadsticks.jpg",
        alt: "Bake",
        ingredients: [
            "Flour",
            "Water",
            "Olive Oil",
            "Garlic",
        ],
        steps: [],
    },
];

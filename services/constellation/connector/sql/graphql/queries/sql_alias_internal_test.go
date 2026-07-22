package queries

import "testing"

func TestSQLAliasShortensAndDisambiguatesPostgresIdentifiers(t *testing.T) {
	t.Parallel()

	parent := "_root.r.nutritionPlan.r.nutritionPlanMeals.r.meal.r.mealIngredients"
	baseAlias := sqlAlias(parent, ".base")
	relAlias := sqlAlias(parent, ".r.", "food")

	if len(baseAlias) > maxPostgresIdentifierBytes {
		t.Fatalf(
			"base alias length = %d, want <= %d: %q",
			len(baseAlias),
			maxPostgresIdentifierBytes,
			baseAlias,
		)
	}

	if len(relAlias) > maxPostgresIdentifierBytes {
		t.Fatalf(
			"relationship alias length = %d, want <= %d: %q",
			len(relAlias),
			maxPostgresIdentifierBytes,
			relAlias,
		)
	}

	if baseAlias == relAlias {
		t.Fatalf("aliases should remain unique after shortening: %q", baseAlias)
	}
}

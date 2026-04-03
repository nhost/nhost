package viewport

import (
	"strings"
	"testing"
)

const defaultHorizontalStep = 6

func TestNew(t *testing.T) {
	t.Parallel()

	t.Run("default values on create by New", func(t *testing.T) {
		t.Parallel()

		m := New(10, 10)
		m.horizontalStep = defaultHorizontalStep // remove on v2

		if !m.initialized {
			t.Errorf("on create by New, Model should be initialized")
		}

		if m.horizontalStep != defaultHorizontalStep {
			t.Errorf("default horizontalStep should be %d, got %d", defaultHorizontalStep, m.horizontalStep)
		}

		if m.MouseWheelDelta != 3 {
			t.Errorf("default MouseWheelDelta should be 3, got %d", m.MouseWheelDelta)
		}

		if !m.MouseWheelEnabled {
			t.Error("mouse wheel should be enabled by default")
		}
	})
}

func TestSetInitialValues(t *testing.T) {
	t.Parallel()

	t.Run("default horizontalStep", func(t *testing.T) {
		t.Parallel()

		m := Model{}
		m.horizontalStep = defaultHorizontalStep // remove on v2
		m.setInitialValues()

		if m.horizontalStep != defaultHorizontalStep {
			t.Errorf("default horizontalStep should be %d, got %d", defaultHorizontalStep, m.horizontalStep)
		}
	})
}

func TestSetHorizontalStep(t *testing.T) {
	t.Parallel()

	t.Run("change default", func(t *testing.T) {
		t.Parallel()

		m := New(10, 10)
		m.horizontalStep = defaultHorizontalStep // remove on v2

		if m.horizontalStep != defaultHorizontalStep {
			t.Errorf("default horizontalStep should be %d, got %d", defaultHorizontalStep, m.horizontalStep)
		}

		newStep := 8
		m.SetHorizontalStep(newStep)
		if m.horizontalStep != newStep {
			t.Errorf("horizontalStep should be %d, got %d", newStep, m.horizontalStep)
		}
	})

	t.Run("no negative", func(t *testing.T) {
		t.Parallel()

		m := New(10, 10)
		m.horizontalStep = defaultHorizontalStep // remove on v2

		if m.horizontalStep != defaultHorizontalStep {
			t.Errorf("default horizontalStep should be %d, got %d", defaultHorizontalStep, m.horizontalStep)
		}

		zero := 0
		m.SetHorizontalStep(-1)
		if m.horizontalStep != zero {
			t.Errorf("horizontalStep should be %d, got %d", zero, m.horizontalStep)
		}
	})
}

func TestScrollLeft(t *testing.T) {
	t.Parallel()

	zeroPosition := 0

	t.Run("zero position", func(t *testing.T) {
		t.Parallel()

		m := New(10, 10)
		m.longestLineWidth = 100
		if m.xOffset != zeroPosition {
			t.Errorf("default indent should be %d, got %d", zeroPosition, m.xOffset)
		}

		m.ScrollLeft(m.horizontalStep)
		if m.xOffset != zeroPosition {
			t.Errorf("indent should be %d, got %d", zeroPosition, m.xOffset)
		}
	})

	t.Run("scroll", func(t *testing.T) {
		t.Parallel()
		m := New(10, 10)
		m.horizontalStep = defaultHorizontalStep // remove on v2
		m.longestLineWidth = 100
		if m.xOffset != zeroPosition {
			t.Errorf("default indent should be %d, got %d", zeroPosition, m.xOffset)
		}

		m.xOffset = defaultHorizontalStep * 2
		m.ScrollLeft(m.horizontalStep)
		newIndent := defaultHorizontalStep
		if m.xOffset != newIndent {
			t.Errorf("indent should be %d, got %d", newIndent, m.xOffset)
		}
	})
}

func TestScrollRight(t *testing.T) {
	t.Parallel()

	t.Run("scroll", func(t *testing.T) {
		t.Parallel()

		zeroPosition := 0

		m := New(10, 10)
		m.SetHorizontalStep(defaultHorizontalStep)
		m.SetContent("Some line that is longer than width")
		if m.xOffset != zeroPosition {
			t.Errorf("default indent should be %d, got %d", zeroPosition, m.xOffset)
		}

		m.ScrollRight(m.horizontalStep)
		newIndent := defaultHorizontalStep
		if m.xOffset != newIndent {
			t.Errorf("indent should be %d, got %d", newIndent, m.xOffset)
		}
	})
}

func TestResetIndent(t *testing.T) {
	t.Parallel()

	t.Run("reset", func(t *testing.T) {
		t.Parallel()

		zeroPosition := 0

		m := New(10, 10)
		m.xOffset = 500

		m.SetXOffset(0)
		if m.xOffset != zeroPosition {
			t.Errorf("indent should be %d, got %d", zeroPosition, m.xOffset)
		}
	})
}

func TestVisibleLines(t *testing.T) {
	t.Parallel()

	defaultList := []string{
		`57 Precepts of narcissistic comedy character Zote from an awesome "Hollow knight" game (https://store.steampowered.com/app/367520/Hollow_Knight/).`,
		`Precept One: 'Always Win Your Battles'. Losing a battle earns you nothing and teaches you nothing. Win your battles, or don't engage in them at all!`,
		`Precept Two: 'Never Let Them Laugh at You'. Fools laugh at everything, even at their superiors. But beware, laughter isn't harmless! Laughter spreads like a disease, and soon everyone is laughing at you. You need to strike at the source of this perverse merriment quickly to stop it from spreading.`,
		`Precept Three: 'Always Be Rested'. Fighting and adventuring take their toll on your body. When you rest, your body strengthens and repairs itself. The longer you rest, the stronger you become.`,
		`Precept Four: 'Forget Your Past'. The past is painful, and thinking about your past can only bring you misery. Think about something else instead, such as the future, or some food.`,
		`Precept Five: 'Strength Beats Strength'. Is your opponent strong? No matter! Simply overcome their strength with even more strength, and they'll soon be defeated.`,
		`Precept Six: 'Choose Your Own Fate'. Our elders teach that our fate is chosen for us before we are even born. I disagree.`,
		`Precept Seven: 'Mourn Not the Dead'. When we die, do things get better for us or worse? There's no way to tell, so we shouldn't bother mourning. Or celebrating for that matter.`,
		`Precept Eight: 'Travel Alone'. You can rely on nobody, and nobody will always be loyal. Therefore, nobody should be your constant companion.`,
		`Precept Nine: 'Keep Your Home Tidy'. Your home is where you keep your most prized possession - yourself. Therefore, you should make an effort to keep it nice and clean.`,
		`Precept Ten: 'Keep Your Weapon Sharp'. I make sure that my weapon, 'Life Ender', is kept well-sharpened at all times. This makes it much easier to cut things.`,
		`Precept Eleven: 'Mothers Will Always Betray You'. This Precept explains itself.`,
		`Precept Twelve: 'Keep Your Cloak Dry'. If your cloak gets wet, dry it as soon as you can. Wearing wet cloaks is unpleasant, and can lead to illness.`,
		`Precept Thirteen: 'Never Be Afraid'. Fear can only hold you back. Facing your fears can be a tremendous effort. Therefore, you should just not be afraid in the first place.`,
		`Precept Fourteen: 'Respect Your Superiors'. If someone is your superior in strength or intellect or both, you need to show them your respect. Don't ignore them or laugh at them.`,
		`Precept Fifteen: 'One Foe, One Blow'. You should only use a single blow to defeat an enemy. Any more is a waste. Also, by counting your blows as you fight, you'll know how many foes you've defeated.`,
		`...`,
	}

	t.Run("empty list", func(t *testing.T) {
		t.Parallel()

		m := New(10, 10)
		list := m.visibleLines()

		if len(list) != 0 {
			t.Errorf("list should be empty, got %d", len(list))
		}
	})

	t.Run("empty list: with indent", func(t *testing.T) {
		t.Parallel()

		m := New(10, 10)
		list := m.visibleLines()
		m.xOffset = 5

		if len(list) != 0 {
			t.Errorf("list should be empty, got %d", len(list))
		}
	})

	t.Run("list", func(t *testing.T) {
		t.Parallel()
		numberOfLines := 10

		m := New(10, numberOfLines)
		m.SetContent(strings.Join(defaultList, "\n"))

		list := m.visibleLines()
		if len(list) != numberOfLines {
			t.Errorf("list should have %d lines, got %d", numberOfLines, len(list))
		}

		lastItemIdx := numberOfLines - 1
		// we trim line if it doesn't fit to width of the viewport
		shouldGet := defaultList[lastItemIdx][:m.Width]
		if list[lastItemIdx] != shouldGet {
			t.Errorf(`%dth list item should be '%s', got '%s'`, lastItemIdx, shouldGet, list[lastItemIdx])
		}
	})

	t.Run("list: with y offset", func(t *testing.T) {
		t.Parallel()
		numberOfLines := 10

		m := New(10, numberOfLines)
		m.SetContent(strings.Join(defaultList, "\n"))
		m.YOffset = 5

		list := m.visibleLines()
		if len(list) != numberOfLines {
			t.Errorf("list should have %d lines, got %d", numberOfLines, len(list))
		}

		if list[0] == defaultList[0] {
			t.Error("first item of list should not be the first item of initial list because of Y offset")
		}

		lastItemIdx := numberOfLines - 1
		// we trim line if it doesn't fit to width of the viewport
		shouldGet := defaultList[m.YOffset+lastItemIdx][:m.Width]
		if list[lastItemIdx] != shouldGet {
			t.Errorf(`%dth list item should be '%s', got '%s'`, lastItemIdx, shouldGet, list[lastItemIdx])
		}
	})

	t.Run("list: with y offset: horizontal scroll", func(t *testing.T) {
		t.Parallel()
		numberOfLines := 10

		m := New(10, numberOfLines)
		m.horizontalStep = defaultHorizontalStep // remove on v2
		m.SetContent(strings.Join(defaultList, "\n"))
		m.SetYOffset(7)

		// default list
		list := m.visibleLines()
		if len(list) != numberOfLines {
			t.Errorf("list should have %d lines, got %d", numberOfLines, len(list))
		}

		lastItem := numberOfLines - 1
		defaultLastItem := len(defaultList) - 1
		if list[lastItem] != defaultList[defaultLastItem] {
			t.Errorf("%dth list item should the the same as %dth default list item", lastItem, defaultLastItem)
		}

		perceptPrefix := "Precept"
		if !strings.HasPrefix(list[0], perceptPrefix) {
			t.Errorf("first list item has to have prefix %s", perceptPrefix)
		}

		// scroll right
		m.ScrollRight(m.horizontalStep)
		list = m.visibleLines()

		newPrefix := perceptPrefix[m.xOffset:]
		if !strings.HasPrefix(list[0], newPrefix) {
			t.Errorf("first list item has to have prefix %s, get %s", newPrefix, list[0])
		}

		if list[lastItem] != "" {
			t.Errorf("last item should be empty, got %s", list[lastItem])
		}

		// scroll left
		m.ScrollLeft(m.horizontalStep)
		list = m.visibleLines()
		if !strings.HasPrefix(list[0], perceptPrefix) {
			t.Errorf("first list item has to have prefix %s", perceptPrefix)
		}

		if list[lastItem] != defaultList[defaultLastItem] {
			t.Errorf("%dth list item should the the same as %dth default list item", lastItem, defaultLastItem)
		}
	})

	t.Run("list: with 2 cells symbols: horizontal scroll", func(t *testing.T) {
		t.Parallel()

		const horizontalStep = 5

		initList := []string{
			"あいうえお",
			"Aあいうえお",
			"あいうえお",
			"Aあいうえお",
		}
		numberOfLines := len(initList)

		m := New(20, numberOfLines)
		m.lines = initList
		m.longestLineWidth = 30 // dirty hack: not checking right overscroll for this test case

		// default list
		list := m.visibleLines()
		if len(list) != numberOfLines {
			t.Errorf("list should have %d lines, got %d", numberOfLines, len(list))
		}

		lastItemIdx := numberOfLines - 1
		initLastItem := len(initList) - 1
		shouldGet := initList[initLastItem]
		if list[lastItemIdx] != shouldGet {
			t.Errorf("%dth list item should the the same as %dth default list item", lastItemIdx, initLastItem)
		}

		// scroll right
		m.ScrollRight(horizontalStep)
		list = m.visibleLines()

		for i := range list {
			cutLine := "うえお"
			if list[i] != cutLine {
				t.Errorf("line must be `%s`, get `%s`", cutLine, list[i])
			}
		}

		// scroll left
		m.ScrollLeft(horizontalStep)
		list = m.visibleLines()
		for i := range list {
			if list[i] != initList[i] {
				t.Errorf("line must be `%s`, get `%s`", list[i], initList[i])
			}
		}

		// scroll left second times do not change lites if indent == 0
		m.xOffset = 0
		m.ScrollLeft(horizontalStep)
		list = m.visibleLines()
		for i := range list {
			if list[i] != initList[i] {
				t.Errorf("line must be `%s`, get `%s`", list[i], initList[i])
			}
		}
	})
}

func TestRightOverscroll(t *testing.T) {
	t.Parallel()

	t.Run("prevent right overscroll", func(t *testing.T) {
		t.Parallel()
		content := "Content is short"
		m := New(len(content)+1, 5)
		m.SetContent(content)

		for i := 0; i < 10; i++ {
			m.ScrollRight(m.horizontalStep)
		}

		visibleLines := m.visibleLines()
		visibleLine := visibleLines[0]

		if visibleLine != content {
			t.Error("visible line should stay the same as content")
		}
	})
}

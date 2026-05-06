# v2 → v3 icon migration map

## Source import (what to remove)

Every v2 icon below is imported from `@/components/ui/v2/icons/<v2Name>` (named
or default export of the same name). The codemod should match against that
import path.

## Replacement targets

Disposition values and the import the codemod should write:

- `lucide` — `import { <name> } from 'lucide-react'`
- `simple-icons` — `import { <name> } from '@icons-pack/react-simple-icons'`
- `already-v3` — `import { <name> } from '@/components/ui/v3/icons/<name>'` (or specific path in notes); the codemod should redirect imports and the v2 copy is deleted afterwards
- `port-to-v3` — **leave alone for now**. Component must first be ported to `@/components/ui/v3/icons/<name>` by hand; codemod runs in a second pass once the v3 file exists
- `delete` — codemod should remove the import + any usage (none expected); v2 file gets deleted
- `special` — skip; handled case by case (see notes)

## JSX prop translation (apply to every replaced site)

- `color="primary"` → `className="text-primary"` (merge with existing class)
- `sx={...}` → equivalent Tailwind classes
- `fontSize="small"` → `size={20}` (lucide/simple-icons take a numeric `size` prop). Verify at the call site rather than relying on a global default.
- Existing `className="h-4 w-4"` (16×16) → bump to `h-5 w-5` (20×20) where layout allows; keep 16×16 only where unavoidable
- Drop `aria-label` from the icon when the wrapping element already has text or its own `aria-label`; keep it only for standalone state-conveying icons

## Mapping table

| v2 component | Disposition | Replacement (named export) | Replacement import path | Notes |
| --- | --- | --- | --- | --- |
| `AIIcon` | lucide | `Sparkles` | `lucide-react` | |
| `ArrowCounterclockwiseIcon` | lucide | `RotateCcw` | `lucide-react` | |
| `ArrowDownIcon` | lucide | `ArrowDown` | `lucide-react` | |
| `ArrowElbowRightUp` | delete | — | — | Unused; delete the v2 file. |
| `ArrowLeftIcon` | lucide | `ArrowLeft` | `lucide-react` | |
| `ArrowRightIcon` | lucide | `ArrowRight` | `lucide-react` | |
| `ArrowSquareOutIcon` | lucide | `ExternalLink` | `lucide-react` | |
| `ArrowUpIcon` | lucide | `ArrowUp` | `lucide-react` | |
| `CalendarIcon` | lucide | `Calendar` | `lucide-react` | |
| `CheckIcon` | lucide | `Check` | `lucide-react` | |
| `ChevronDownIcon` | lucide | `ChevronDown` | `lucide-react` | |
| `ChevronLeftIcon` | lucide | `ChevronLeft` | `lucide-react` | |
| `ChevronRightIcon` | lucide | `ChevronRight` | `lucide-react` | |
| `ChevronUpIcon` | lucide | `ChevronUp` | `lucide-react` | |
| `CircularProgress` | already-v3 | `Spinner` | `@/components/ui/v3/spinner` | Not a like-for-like swap. Migrate v2 `ActivityIndicator` and its call sites to `Spinner` first, then delete `CircularProgress`. Codemod should skip and surface for manual review. |
| `ClockIcon` | lucide | `Clock` | `lucide-react` | |
| `CloudIcon` | lucide | `Cloud` | `lucide-react` | |
| `CogIcon` | lucide | `Settings` | `lucide-react` | |
| `ColumnIcon` | lucide | `Columns3` | `lucide-react` | |
| `CopyIcon` | lucide | `Copy` | `lucide-react` | |
| `DatabaseIcon` | lucide | `Database` | `lucide-react` | |
| `DotsHorizontalIcon` | lucide | `Ellipsis` | `lucide-react` | |
| `DotsVerticalIcon` | lucide | `EllipsisVertical` | `lucide-react` | |
| `EmbeddingsIcon` | already-v3 | `EmbeddingsIcon` | `@/components/ui/v3/icons/EmbeddingsIcon` | Done — ported and call sites migrated in #4202. |
| `ExclamationFilledIcon` | lucide | `CircleAlert` | `lucide-react` | Lucide is outline-only; if filled appearance is needed, add `className="fill-current"` (or a specific `fill-*` color) at the call site. |
| `ExclamationIcon` | lucide | `CircleAlert` | `lucide-react` | |
| `EyeIcon` | lucide | `Eye` | `lucide-react` | |
| `EyeOffIcon` | lucide | `EyeOff` | `lucide-react` | |
| `FileStoresIcon` | already-v3 | `FileStoresIcon` | `@/components/ui/v3/icons/FileStoresIcon` | Done — ported and call sites migrated in #4202. |
| `FileTextIcon` | lucide | `FileText` | `lucide-react` | |
| `FullPermissionIcon` | already-v3 | `FullPermissionIcon` | `@/components/ui/v3/icons/FullPermissionIcon` | Redirect imports; v2 copy deleted afterwards. |
| `GaugeIcon` | lucide | `Gauge` | `lucide-react` | |
| `GitHubIcon` | simple-icons | `SiGithub` | `@icons-pack/react-simple-icons` | |
| `GraphQLIcon` | simple-icons | `SiGraphql` | `@icons-pack/react-simple-icons` | |
| `HasuraIcon` | simple-icons | `SiHasura` | `@icons-pack/react-simple-icons` | |
| `HomeIcon` | lucide | `Home` | `lucide-react` | |
| `InfoIcon` | lucide | `Info` | `lucide-react` | |
| `InfoOutlinedIcon` | lucide | `Info` | `lucide-react` | Collapses with `InfoIcon`. |
| `LinkIcon` | lucide | `Link` | `lucide-react` | Lucide export is `Link`; alias on import if `Link` collides with a router import: `import { Link as LinkIcon } from 'lucide-react'`. |
| `LockIcon` | lucide | `Lock` | `lucide-react` | |
| `MenuIcon` | lucide | `Menu` | `lucide-react` | |
| `MinusIcon` | lucide | `Minus` | `lucide-react` | |
| `NoPermissionIcon` | already-v3 | `NoPermissionIcon` | `@/components/ui/v3/icons/NoPermissionIcon` | |
| `PartialPermissionIcon` | already-v3 | `PartialPermissionIcon` | `@/components/ui/v3/icons/PartialPermissionIcon` | |
| `PencilIcon` | lucide | `SquarePen` | `lucide-react` | |
| `PlayIcon` | lucide | `Play` | `lucide-react` | |
| `PlusCircleIcon` | lucide | `CirclePlus` | `lucide-react` | |
| `PlusIcon` | lucide | `Plus` | `lucide-react` | |
| `PowerOffIcon` | lucide | `PowerOff` | `lucide-react` | |
| `QuestionMarkCircleIcon` | lucide | `CircleHelp` | `lucide-react` | |
| `QuestionMarkIcon` | already-v3 | `QuestionMarkIcon` | `@/components/ui/v3/icons/QuestionMarkIcon` | Done — ported and call sites migrated in #4202. Bare "?" — Lucide has no equivalent. |
| `RepeatIcon` | lucide | `Repeat` | `lucide-react` | |
| `RocketIcon` | lucide | `Rocket` | `lucide-react` | |
| `RowIcon` | lucide | `Rows3` | `lucide-react` | |
| `SearchIcon` | lucide | `Search` | `lucide-react` | |
| `ServicesIcon` | simple-icons | `SiDocker` | `@icons-pack/react-simple-icons` | |
| `ServicesOutlinedIcon` | already-v3 | `ServicesOutlinedIcon` | `@/components/ui/v3/icons/ServicesOutlinedIcon` | Done — ported and call sites migrated in #4202. |
| `SlidersIcon` | lucide | `SlidersHorizontal` | `lucide-react` | |
| `StorageIcon` | lucide | `HardDrive` | `lucide-react` | |
| `SvgIcon` | already-v3 | — | — | Base MUI wrapper. No replacement; delete in final cleanup once nothing else extends it. |
| `TerminalIcon` | lucide | `Terminal` | `lucide-react` | |
| `TrashIcon` | lucide | `Trash2` | `lucide-react` | |
| `UploadIcon` | lucide | `Upload` | `lucide-react` | |
| `UserIcon` | lucide | `User` | `lucide-react` | |
| `UsersIcon` | lucide | `Users` | `lucide-react` | |
| `WarningIcon` | lucide | `TriangleAlert` | `lucide-react` | |
| `XIcon` | lucide | `X` | `lucide-react` | |

## Conventions when applying these mappings

- **Default size.** v2 mostly renders at 16×16 (`h-4 w-4`); Lucide looks fuzzy at
  that size. Bump call sites to 20×20 (`h-5 w-5`) where layout allows. Keep
  16×16 only where unavoidable (tight badge dots) and port those to v3/icons as
  solid SVGs.
- **Ported v2 icons.** When porting `EmbeddingsIcon`, `FileStoresIcon`, etc.
  into `v3/icons`: redraw at a 24×24 viewBox to match
  Lucide's grid. If the icon sits next to Lucide siblings (nav, menus) switch
  from filled to stroked outline at `strokeWidth=2`.
- **Prop translation.** MUI `color="primary"` → `className="text-primary"`.
  `sx={...}` → Tailwind classes. Lucide uses `stroke="currentColor"`, so
  `text-*` controls line color and `fill-*` controls fill.
- **Accessibility.** v2 icons hardcode an `aria-label` on the SVG; Lucide ships
  decorative SVGs (no label, no `role="img"`). Per call site:
  - Icon-only button/link → `aria-label` on the wrapping element.
  - Icon next to text → leave decorative.
  - Standalone state-conveying icon with no nearby text → `aria-label` on the icon.
  - Tooltip-trigger info icons → tooltip provides the announcement; icon stays decorative.

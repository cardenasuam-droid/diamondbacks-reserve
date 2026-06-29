import {
  Home,
  CalendarDays,
  Swords,
  Trophy,
  Users,
  BarChart3,
  Newspaper,
  ScrollText,
  CircleUser,
  Bell,
  ClipboardList,
  ListChecks,
  LayoutDashboard,
  CircleCheckBig,
  SquarePen,
  FileUp,
  Megaphone,
  FlaskConical,
  LayoutGrid,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Plus,
  LogOut,
  Medal,
  Ban,
  Lock,
  Share2,
  type LucideIcon,
} from 'lucide-react'

// Registro central de iconos (Lucide). Se referencian por nombre semántico para
// mantener un único estilo de icono en toda la app (sin emojis). Añade aquí los
// que necesites y se vuelven type-safe automáticamente.
const REGISTRY = {
  home: Home,
  schedule: CalendarDays,
  results: Swords,
  standings: Trophy,
  teams: Users,
  stats: BarChart3,
  news: Newspaper,
  rules: ScrollText,
  account: CircleUser,
  bell: Bell,
  captain: ClipboardList,
  lineup: ListChecks,
  organizer: LayoutDashboard,
  'lineups-status': CircleCheckBig,
  check: CircleCheckBig,
  'results-edit': SquarePen,
  import: FileUp,
  announce: Megaphone,
  dev: FlaskConical,
  more: LayoutGrid,
  menu: Menu,
  close: X,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  search: Search,
  plus: Plus,
  logout: LogOut,
  medal: Medal,
  ban: Ban,
  lock: Lock,
  share: Share2,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof REGISTRY

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 2,
}: {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}) {
  const Cmp = REGISTRY[name]
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
}

import {
  ClipboardCheck,
  LayoutDashboard,
  MapPin,
  Package,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Reportes",
    items: [
      {
        title: "Resumen Comercial",
        url: "/dashboard/resumen-comercial",
        icon: LayoutDashboard,
      },
      {
        title: "Control de Cartera y Saldos",
        url: "/dashboard/cartera",
        icon: Wallet,
      },
      {
        title: "Eficiencia de Órdenes",
        url: "/dashboard/eficiencia",
        icon: ClipboardCheck,
      },
      {
        title: "Desempeño Clínico",
        url: "/dashboard/clinico",
        icon: Stethoscope,
      },
      {
        title: "Inventario",
        url: "/dashboard/inventario",
        icon: Package,
      },
    ],
  },
  {
    id: 2,
    label: "Configuración",
    items: [
      {
        title: "Usuarios",
        url: "/dashboard/usuarios",
        icon: Users,
      },
      {
        title: "Sucursales",
        url: "/dashboard/sucursales",
        icon: MapPin,
      },
    ],
  },
];

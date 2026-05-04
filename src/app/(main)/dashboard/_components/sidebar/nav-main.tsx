"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NavGroup, NavMainItem } from "@/navigation/sidebar/sidebar-items";

interface NavMainProps {
  readonly items: readonly NavGroup[];
}

const IsComingSoon = () => (
  <span className="ml-auto rounded-md bg-gray-200 px-2 py-1 text-xs dark:text-gray-800">Soon</span>
);

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();

  const isItemActive = (url: string, subItems?: NavMainItem["subItems"]) => {
    if (subItems?.length) {
      return subItems.some((sub) => pathname.startsWith(sub.url));
    }
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isItemActive(item.url, item.subItems);

                if (!item.subItems || item.subItems.length === 0) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        aria-disabled={item.comingSoon}
                        tooltip={item.title}
                        isActive={pathname === item.url}
                      >
                        <Link prefetch={false} href={item.url} target={item.newTab ? "_blank" : undefined}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                          {item.comingSoon && <IsComingSoon />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                if (state === "collapsed" && !isMobile) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            disabled={item.comingSoon}
                            tooltip={item.title}
                            isActive={active}
                          >
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight />
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-50 space-y-1" side="right" align="start">
                          {item.subItems.map((subItem) => (
                            <DropdownMenuItem key={subItem.title} asChild>
                              <SidebarMenuSubButton
                                asChild
                                className="focus-visible:ring-0"
                                aria-disabled={subItem.comingSoon}
                                isActive={pathname === subItem.url}
                              >
                                <Link prefetch={false} href={subItem.url} target={subItem.newTab ? "_blank" : undefined}>
                                  {subItem.icon && <subItem.icon className="[&>svg]:text-sidebar-foreground" />}
                                  <span>{subItem.title}</span>
                                  {subItem.comingSoon && <IsComingSoon />}
                                </Link>
                              </SidebarMenuSubButton>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <Collapsible key={item.title} asChild defaultOpen={active} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          disabled={item.comingSoon}
                          isActive={active}
                          tooltip={item.title}
                        >
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                          {item.comingSoon && <IsComingSoon />}
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton aria-disabled={subItem.comingSoon} isActive={pathname === subItem.url} asChild>
                                <Link prefetch={false} href={subItem.url} target={subItem.newTab ? "_blank" : undefined}>
                                  {subItem.icon && <subItem.icon />}
                                  <span>{subItem.title}</span>
                                  {subItem.comingSoon && <IsComingSoon />}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

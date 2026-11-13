import { createContext, useContext, type ReactNode } from "react";
import { business, type BusinessConfig } from "@/lib/business";
const Context = createContext<BusinessConfig>(business);
export function BusinessProvider({
  value,
  children,
}: {
  value: BusinessConfig;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBusiness() {
  return useContext(Context);
}

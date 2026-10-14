import type { RouteObject } from "react-router";
import Homepage from "../pages/Homepage/Homepage";
import NotFound from "../pages/NotFound";

export const routes: RouteObject[] = [
  { path: "/", Component: Homepage },
  { path: "*", Component: NotFound },
];

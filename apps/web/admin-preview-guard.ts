const adminRoutePrefixes = ["/admin"];

export function getAdminPreviewRedirectPath(pathname: string) {
  const isAdminRoute = adminRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return isAdminRoute ? "/login" : null;
}

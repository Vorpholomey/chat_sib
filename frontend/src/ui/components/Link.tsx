import type { ComponentProps } from "react";
import { Link as RouterLink } from "react-router-dom";
import { cn } from "../lib/cn";

type RouterProps = ComponentProps<typeof RouterLink> & { external?: false };
type AnchorProps = ComponentProps<"a"> & { external: true };

type Props = RouterProps | AnchorProps;

const linkClass = "text-link hover:underline";

export function Link(props: Props) {
  if ("external" in props && props.external) {
    const { external: _external, className, ...anchorProps } = props;
    void _external;
    return <a className={cn(linkClass, className)} {...anchorProps} />;
  }

  const { className, ...routerProps } = props;
  return <RouterLink className={cn(linkClass, className)} {...routerProps} />;
}

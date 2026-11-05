import ControlPlaneStatic from "./ControlPlaneStatic";
import LazyScene from "./LazyScene";

const load = () => import("./ControlPlaneScene");

/** The hero illustration: the control-plane scene over its still. */
export default function HeroVisual({ className = "" }: { className?: string }) {
  return <LazyScene load={load} still={<ControlPlaneStatic className="h-full w-full" />} className={className} />;
}

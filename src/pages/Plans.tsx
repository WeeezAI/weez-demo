import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check, Zap, Rocket, Cpu, Shield, Globe, Gift, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast"; // Ensure this hook exists or use sonner if preferred
import { cn } from "@/lib/utils";
import { weezAPI } from "@/services/weezAPI";
import logo from "@/assets/weez-logo.png";

const Plans = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Assuming refreshUser exists to update local state
    const { toast } = useToast();

    const [redeemCode, setRedeemCode] = useState("");
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [apiPlans, setApiPlans] = useState<any[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(true);

    // Load available plans
    useEffect(() => {
        const loadPlans = async () => {
            try {
                const data = await weezAPI.getPlans();
                setApiPlans(data);
            } catch (error) {
                console.error("Failed to load plans", error);
            } finally {
                setIsLoadingPlans(false);
            }
        };
        loadPlans();
    }, []);

    const handlePayment = async (plan: any) => {
        if (plan.tier === 'free') return; // No payment for free tier

        // Find corresponding API plan
        const apiPlan = apiPlans.find(p => {
            if (plan.tier === 'premium-monthly' && p.billing_cycle === 'monthly') return true;
            if (plan.tier === 'premium-yearly' && p.billing_cycle === 'yearly') return true;
            return false;
        });

        if (!apiPlan) {
            toast({
                title: "Plan Unavailable",
                description: "This plan is currently not available for subscription.",
                variant: "destructive"
            });
            return;
        }

        try {
            // 1. Create Order
            const order = await weezAPI.createPaymentOrder(apiPlan.id);

            // 2. Open Razorpay
            const options = {
                key: order.key_id,
                amount: order.amount,
                currency: order.currency,
                name: "Weez AI",
                description: `Subscription to ${plan.name}`,
                image: logo, // Use imported logo
                order_id: order.razorpay_order_id,
                handler: async function (response: any) {
                    try {
                        // 3. Verify Payment
                        await weezAPI.verifyPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });

                        toast({
                            title: "Subscription Activated",
                            description: `You are now subscribed to ${plan.name}!`,
                            className: "bg-emerald-500 text-white border-none"
                        });

                        // Refresh user data (assuming AuthContext has a refresh method, or just reload)
                        window.location.reload();

                    } catch (err: any) {
                        toast({
                            title: "activiation failed",
                            description: err.message,
                            variant: "destructive"
                        });
                    }
                },
                prefill: {
                    name: user?.name,
                    email: user?.email,
                },
                theme: {
                    color: "#7c3aed" // Primary color
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                toast({
                    title: "Payment Failed",
                    description: response.error.description,
                    variant: "destructive"
                });
            });
            rzp.open();

        } catch (error: any) {
            toast({
                title: "Initialization Failed",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    const handleRedeem = async () => {
        if (!redeemCode.trim()) return;
        setIsRedeeming(true);
        try {
            // New endpoint in auth service
            const response = await fetch("https://dexraflow-auth-api-dsaafqdxamgma9hx.canadacentral-01.azurewebsites.net/subscription/redeem", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}` // Ensure token is available
                },
                body: JSON.stringify({ code: redeemCode.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Redemption failed");
            }

            toast({
                title: "Code Redeemed!",
                description: "You have successfully activated your Premium 2-Month Pass.",
                className: "bg-emerald-500 text-white border-none"
            });

            // Clear input - user data will refresh on next page load
            setRedeemCode("");

        } catch (error: any) {
            toast({
                title: "Redemption Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsRedeeming(false);
        }
    };

    const plans = [
        {
            name: "Free Tier",
            price: "$0",
            period: "forever",
            description: "Essential tactical intelligence for creators.",
            features: [
                "1 Brand Workspace",
                "10 Strategic Post Artifacts",
                "Standard AI Creative Engine",
                "Basic Analytics Trace",
            ],
            cta: "Current Plan",
            highlight: false,
            tier: "free"
        },
        {
            name: "Premium Monthly",
            price: "$29",
            period: "per month",
            description: "High-velocity production for scaling brands.",
            features: [
                "Unrestricted Workspaces",
                "Infinite Artifact Generation",
                "Advanced AI Design Studio",
                "Deep Analytical Intelligence",
                "Priority Handshake Engine",
            ],
            cta: "Activate Scale",
            highlight: true,
            tier: "premium-monthly"
        },
        {
            name: "Premium Yearly",
            price: "$299",
            period: "per year",
            description: "The ultimate marketing workforce for professionals.",
            features: [
                "Everything in Monthly",
                "2 Months Free Included",
                "White-Glove Onboarding",
                "Early Access to Lab Tools",
                "Dedicated Brand Memory Path",
            ],
            cta: "Execute Mastery",
            highlight: false,
            tier: "premium-yearly"
        }
    ];

    return (
        <div className="min-h-screen bg-[#FDFBFF] text-foreground font-sans selection:bg-primary/10">
            {/* Minimal Header */}
            <header className="h-24 flex items-center justify-between px-10 border-b border-border/40 backdrop-blur-3xl bg-white/60 sticky top-0 z-50">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate("/spaces")}>
                    <img src={logo} alt="Weez AI" className="h-8 weez-logo" />
                </div>
                <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100" onClick={() => navigate("/spaces")}>
                    Cancel Return
                </Button>
            </header>

            <main className="max-w-[1400px] mx-auto px-10 py-32">
                <div className="text-center space-y-8 mb-32">
                    <Badge className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] px-6 py-2.5 rounded-full border-none">
                        Intelligence Tiers
                    </Badge>
                    <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.85] uppercase">
                        Choose Your <br />
                        <span className="text-muted-foreground/20">Operational Level.</span>
                    </h1>
                    <p className="text-xl font-medium text-muted-foreground max-w-2xl mx-auto opacity-70 leading-relaxed">
                        Select the power level required for your marketing workforce. Transact for absolute scale.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-12 relative z-10">
                    {plans.map((plan) => (
                        <Card
                            key={plan.name}
                            className={cn(
                                "group relative border-none rounded-[4rem] p-12 flex flex-col justify-between transition-all duration-700 overflow-hidden min-h-[700px]",
                                plan.highlight
                                    ? "bg-foreground text-background shadow-[0_80px_160px_rgba(0,0,0,0.1)] scale-105 z-10"
                                    : "bg-white hover:shadow-[0_60px_120px_rgba(0,0,0,0.05)]"
                            )}
                        >
                            {plan.highlight && (
                                <div className="absolute top-10 right-10">
                                    <div className="px-5 py-2 bg-primary rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-primary/40 animate-pulse">
                                        Strategic Choice
                                    </div>
                                </div>
                            )}

                            {/* Plan Identity */}
                            <div className="space-y-12">
                                <div className="space-y-4">
                                    <h3 className={cn("text-3xl font-black tracking-tight uppercase", plan.highlight ? "text-white" : "text-foreground")}>
                                        {plan.name}
                                    </h3>
                                    <p className={cn("text-sm font-medium leading-relaxed opacity-60", plan.highlight ? "text-white/60" : "text-muted-foreground")}>
                                        {plan.description}
                                    </p>
                                </div>

                                <div className="flex items-baseline gap-2">
                                    <span className="text-7xl font-black tracking-tighter leading-none">{plan.price}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{plan.period}</span>
                                </div>

                                <div className="h-px w-full bg-border/20" />

                                {/* Features Grid */}
                                <ul className="space-y-6">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-4 group/feature">
                                            <div className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all",
                                                plan.highlight ? "bg-white/10 text-white" : "bg-primary/5 text-primary"
                                            )}>
                                                <Check className="w-3 h-3" />
                                            </div>
                                            <span className={cn("text-sm font-bold opacity-80", plan.highlight ? "text-white" : "text-foreground")}>
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Tactical Call to Action */}
                            <div className="mt-20 pt-12">
                                <Button
                                    className={cn(
                                        "w-full h-20 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-500 active:scale-95 shadow-2xl",
                                        plan.highlight
                                            ? "bg-primary text-white hover:bg-accent shadow-primary/20"
                                            : "bg-secondary text-foreground hover:bg-foreground hover:text-white"
                                    )}
                                    disabled={user?.plan_type === plan.tier}
                                    onClick={() => handlePayment(plan)}
                                >
                                    {user?.plan_type === plan.tier ? "Current Level" : plan.cta}
                                </Button>
                            </div>

                            {/* Background Ornament */}
                            <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none rotate-12">
                                {plan.tier === "free" && <Zap className="w-64 h-64" />}
                                {plan.tier === "premium-monthly" && <Rocket className="w-64 h-64" />}
                                {plan.tier === "premium-yearly" && <Cpu className="w-64 h-64" />}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* PROMOTION REDEMPTION HUB */}
                <div className="mt-32 max-w-2xl mx-auto">
                    <div className="bg-white rounded-[3rem] p-12 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40 text-center space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                            <Gift className="w-48 h-48 -rotate-12" />
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary rounded-full">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Weez Special Access</span>
                            </div>
                            <h3 className="text-3xl font-black tracking-tight uppercase">Have a Promo Code?</h3>
                            <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                                Enter your code below to unlock extended capabilities and premium features instantly.
                            </p>
                        </div>

                        <div className="flex gap-4 relative z-10">
                            <Input
                                placeholder="WEEZ-XXXXXXXX"
                                value={redeemCode}
                                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                className="h-16 rounded-[1.5rem] bg-secondary border-transparent text-center font-mono text-lg tracking-widest placeholder:text-muted-foreground/30 focus:border-primary/20 transition-all uppercase"
                            />
                            <Button
                                onClick={handleRedeem}
                                disabled={isRedeeming || !redeemCode}
                                className="h-16 w-16 shrink-0 rounded-[1.5rem] bg-primary text-white hover:bg-accent transition-all shadow-xl shadow-primary/20"
                            >
                                {isRedeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Secure Payment Assurance */}
                <div className="mt-40 flex flex-col md:flex-row items-center justify-between gap-10 opacity-30 grayscale grayscale hover:grayscale-0 transition-all">
                    <div className="flex items-center gap-4">
                        <Shield className="w-10 h-10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest">Vault Security</span>
                            <span className="text-[8px] font-bold opacity-60 uppercase">AES-256 Protocol Trace Active</span>
                        </div>
                    </div>
                    <div className="flex gap-14 items-center">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest">Global Engine</span>
                            <div className="flex gap-2">
                                <Globe className="w-4 h-4" />
                                <span className="text-[10px] font-mono leading-none">STRIPE // PAYPAL // CRYPTO</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Plans;

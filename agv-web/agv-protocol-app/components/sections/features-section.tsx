import * as React from "react"
import { cn } from "@/lib/utils"
import { FeatureCard } from "@/components/ui/feature-card"
import { 
  Shield, 
  Zap, 
  Globe, 
  Users, 
  BarChart3, 
  Wallet,
  Lock,
  TrendingUp
} from "lucide-react"

interface FeaturesSectionProps {
  className?: string
}

const features = [
  {
    title: "Multi-Chain Support",
    description: "Mint NFTs across BNB Chain, Polygon, and Arbitrum with seamless cross-chain functionality.",
    icon: Globe,
  },
  {
    title: "Enterprise Security",
    description: "Bank-grade security with advanced encryption and secure wallet integration.",
    icon: Shield,
  },
  {
    title: "Lightning Fast",
    description: "Optimized smart contracts ensure fast and efficient NFT minting with minimal gas fees.",
    icon: Zap,
  },
  {
    title: "KOL Management",
    description: "Comprehensive Key Opinion Leader tracking and analytics dashboard.",
    icon: Users,
  },
  {
    title: "Real-time Analytics",
    description: "Advanced analytics and reporting tools for tracking mint performance and trends.",
    icon: BarChart3,
  },
  {
    title: "Wallet Integration",
    description: "Seamless integration with popular wallets including MetaMask, Trust Wallet, and more.",
    icon: Wallet,
  },
  {
    title: "Secure Transactions",
    description: "All transactions are secured with industry-standard encryption and verification.",
    icon: Lock,
  },
  {
    title: "Performance Tracking",
    description: "Track your NFT performance with detailed metrics and growth analytics.",
    icon: TrendingUp,
  },
]

export function FeaturesSection({ className }: FeaturesSectionProps) {
  return (
    <section className={cn("py-24 lg:py-32", className)}>
      <div className="container">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold">
            Why Choose AGV NEXRUR?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience the next generation of NFT minting with our cutting-edge 
            platform designed for creators, collectors, and enterprises.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              className="h-full"
            />
          ))}
        </div>
      </div>
    </section>
  )
}

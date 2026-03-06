import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, 
  Zap, 
  Users,
  Star,
  Coins
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface HeroSectionProps {
  className?: string
}

export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section className={cn(
      "relative overflow-hidden bg-gradient-to-br from-secondary via-background to-primary",
      className
    )}>
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        
        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-glow delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-glow delay-2000" />
        <div className="absolute top-3/4 left-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-glow delay-3000" />
        
        {/* Floating Geometric Shapes */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-primary/20 rotate-45 animate-float delay-300" />
        <div className="absolute top-40 right-20 w-6 h-6 bg-secondary/20 rounded-full animate-drift delay-700" />
        <div className="absolute bottom-32 left-1/4 w-3 h-3 bg-accent/20 rotate-12 animate-float delay-1000" />
        <div className="absolute bottom-20 right-1/3 w-5 h-5 bg-primary/20 rounded-full animate-drift delay-500" />
        <div className="absolute top-1/3 right-10 w-2 h-2 bg-secondary/30 rotate-45 animate-float delay-1500" />
        <div className="absolute bottom-1/3 left-20 w-4 h-4 bg-accent/25 rounded-full animate-drift delay-2000" />
        
        {/* Subtle Mesh Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/3 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-secondary/2 to-transparent" />
        
        {/* Radial Gradient from Center */}
        <div className="absolute inset-0 bg-radial-gradient from-primary/5 via-transparent to-transparent" />
        
        {/* Additional Depth Layers */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/5 to-transparent" />
        
        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E')]" />
      </div>
      
      <div className="container relative py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit">
                <Star className="w-3 h-3 mr-1" />
                Decentralized Computing Platform
              </Badge>
              
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
                AGV Protocol
                <span className="text-primary block">NFT Ecosystem</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl">
                Mint exclusive SeedPass, TreePass, SolarPass, and ComputePass NFTs. 
                Stake your NFTs to earn daily rewards with no lock-up period across 
                BSC, Polygon, and Arbitrum networks.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/mint">
                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  <Coins className="mr-2 h-5 w-5" />
                  Start Minting
                </Button>
              </Link>
              <Link href="/staking">
                <Button size="lg" variant="outline" className="border-2 border-blue-200 text-blue-600 hover:bg-blue-50 px-8 py-4 text-lg font-semibold transition-all duration-300">
                  <Zap className="mr-2 h-5 w-5" />
                  View Staking
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">3</div>
                <div className="text-sm text-muted-foreground">Blockchains</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">4</div>
                <div className="text-sm text-muted-foreground">NFT Collections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">50 rGGP</div>
                <div className="text-sm text-muted-foreground">Daily Rewards</div>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="relative z-10">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                        <Image 
                          src="/logo.svg" 
                          alt="AGV Protocol" 
                          width={32} 
                          height={32}
                          className="rounded-lg"
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">AGV Protocol</h3>
                        <p className="text-sm text-muted-foreground">NFT Minting Platform</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Floating Cards */}
            <div className="absolute -top-4 -right-4 z-20">
              <Card className="w-32 p-3 bg-background/80 backdrop-blur">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium">Secure</span>
                </div>
              </Card>
            </div>
            
            <div className="absolute -bottom-4 -left-4 z-20">
              <Card className="w-32 p-3 bg-background/80 backdrop-blur">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs font-medium">Fast</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface FeatureCardProps {
  title: string
  description: string
  icon: LucideIcon
  className?: string
  children?: React.ReactNode
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  children,
}: FeatureCardProps) {
  return (
    <Card className={cn("group hover:shadow-lg transition-all duration-300", className)}>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {children && (
        <CardContent>
          {children}
        </CardContent>
      )}
    </Card>
  )
}

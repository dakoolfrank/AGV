import * as React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Users, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Copy,
  Search,
  Filter,
  Activity
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/hooks/useTranslations"
import { createLocalizedHref } from "@/lib/locale-utils"

interface KOL {
  kolId: string
  name: string
  walletAddress: string
  email?: string | null
  target?: number
  seed?: number
  tree?: number
  solar?: number
  compute?: number
  updatedAt?: string | number
}

interface KOLManagementProps {
  kols: KOL[]
  onDeleteKOL: (kolId: string) => void
  onCreateKOL: (data: { name: string; walletAddress: string; email?: string; target?: number }) => Promise<boolean>
  canCreateKOL: boolean
  canDeleteKOL: boolean
  className?: string
}

export function KOLManagement({ 
  kols, 
  onDeleteKOL, 
  onCreateKOL, 
  canCreateKOL, 
  canDeleteKOL,
  className 
}: KOLManagementProps) {
  const { locale } = useTranslations()
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    walletAddress: "",
    email: "",
    target: ""
  })

  const filteredKols = kols.filter(kol =>
    kol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kol.kolId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kol.walletAddress.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateKOL = async () => {
    if (!createForm.name || !createForm.walletAddress) {
      toast.error("Name and wallet address are required")
      return
    }

    setIsCreating(true)
    try {
      const success = await onCreateKOL({
        name: createForm.name,
        walletAddress: createForm.walletAddress,
        email: createForm.email || undefined,
        target: createForm.target ? Number(createForm.target) : undefined
      })

      if (success) {
        setCreateForm({ name: "", walletAddress: "", email: "", target: "" })
        setIsCreateDialogOpen(false)
        toast.success("KOL created successfully")
      }
    } catch {
      toast.error("Failed to create KOL")
    } finally {
      setIsCreating(false)
    }
  }

  const copyReferralLink = (kolId: string) => {
    // Extract the 6-digit number from KOL ID (e.g., "AGV-KOL461337" -> "461337")
    const digits = kolId.match(/\d{6}/)?.[0] || ""
    const localizedMintPath = createLocalizedHref(`/mint/${digits}`, locale)
    const link = `${window.location.origin}${localizedMintPath}`
    navigator.clipboard.writeText(link)
    toast.success("Referral link copied")
  }



  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => window.open(createLocalizedHref('/admin/kols/activities', locale), '_blank')}
          >
            <Activity className="h-4 w-4 mr-2" />
            View Activities
          </Button>
          {canCreateKOL && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create KOL
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New KOL</DialogTitle>
                <DialogDescription>
                  Add a new Key Opinion Leader to the system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter KOL name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet">Wallet Address *</Label>
                  <Input
                    id="wallet"
                    value={createForm.walletAddress}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, walletAddress: e.target.value }))}
                    placeholder="0x..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="kol@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target</Label>
                  <Input
                    id="target"
                    type="number"
                    value={createForm.target}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, target: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateKOL}
                    disabled={isCreating}
                  >
                    {isCreating ? "Creating..." : "Create KOL"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search KOLs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* KOL Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>KOLs ({filteredKols.length})</span>
          </CardTitle>
          <CardDescription>
            All registered Key Opinion Leaders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>KOL ID</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Referral Link</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKols.map((kol) => {
                  // Extract the 6-digit number from KOL ID for the referral link
                  const digits = kol.kolId.match(/\d{6}/)?.[0] || ""
                  const localizedMintPath = createLocalizedHref(`/mint/${digits}`, locale)
                  const referralLink = `${window.location.origin}${localizedMintPath}`
                  const localizedKolPath = createLocalizedHref(`/admin/kols/${kol.kolId}`, locale)
                  
                  return (
                    <TableRow key={kol.kolId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{kol.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            KOL
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {kol.kolId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                          {kol.walletAddress}
                        </code>
                      </TableCell>
                      <TableCell>{kol.email || "—"}</TableCell>
                      <TableCell>{kol.target || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                            {referralLink}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyReferralLink(kol.kolId)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={localizedKolPath} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                          {canDeleteKOL && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteKOL(kol.kolId)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthGuard } from "@/components/auth-guard"
import { useIsTablet } from "@/hooks/use-tablet"
import { 
  HelpCircle, 
  Search, 
  Shield, 
  Download, 
  XCircle,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Certificate {
  id: string
  certificate_number: string
  product_name: string
  status: string
  coverage_limit: number
  deductible: number
  premium: number
  service_fee: number
  tax: number
  total_cost: number
  currency: string
  certificate_link?: string
  certificate_with_cover_link?: string
  terms_conditions_link?: string
  file_claim_link?: string
  purchased_at: string
  order_id?: string
  order_number?: string
  cancelled_at?: string
  cancellation_reason?: string
}

interface CancellationFormData {
  reason: string
  additionalInfo: string
}

function InsuranceCertificatesContent() {
  const isTablet = useIsTablet()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancellationForm, setCancellationForm] = useState<CancellationFormData>({
    reason: "",
    additionalInfo: ""
  })
  const [error, setError] = useState("")

  useEffect(() => {
    fetchCertificates()
  }, [])

  const fetchCertificates = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      
      // Fetch certificates along with order information
      const response = await fetch("/api/insurance/certificates", {
        headers: {
          "Authorization": `Bearer ${user.id}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("Fetched certificates:", data.certificates)
        // Log the status of each certificate for debugging
        data.certificates?.forEach((cert: Certificate) => {
          console.log(`Certificate ${cert.certificate_number}: status = "${cert.status}", type = ${typeof cert.status}`)
        })
        setCertificates(data.certificates || [])
      }
    } catch (err) {
      console.error("Error fetching certificates:", err)
    } finally {
      setLoading(false)
    }
  }

  const downloadCertificate = (certificate: Certificate) => {
    if (certificate.certificate_link) {
      window.open(certificate.certificate_link, "_blank")
    }
  }

  const openCancelDialog = (certificate: Certificate) => {
    setSelectedCertificate(certificate)
    setCancelDialogOpen(true)
    setError("")
    setCancellationForm({ reason: "", additionalInfo: "" })
  }

  const cancelCertificate = async () => {
    if (!selectedCertificate || !cancellationForm.reason) {
      setError("Please select a cancellation reason")
      return
    }

    setCancelling(true)
    setError("")

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      
      const response = await fetch("/api/insurance/certificate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          certificateNumber: selectedCertificate.certificate_number,
          cancellationReason: cancellationForm.reason,
          cancellationAdditionalInfo: cancellationForm.additionalInfo,
          emailAssured: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh certificates list
        await fetchCertificates()
        setCancelDialogOpen(false)
      } else {
        setError(data.error || "Failed to cancel certificate")
      }
    } catch (err) {
      setError("Error cancelling certificate")
      console.error(err)
    } finally {
      setCancelling(false)
    }
  }

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const upperStatus = status?.toUpperCase()
    switch (upperStatus) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" />
            Active
          </span>
        )
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="h-3 w-3" />
            Cancelled
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        )
    }
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center px-4 lg:px-6 border-b">
          <SidebarTrigger />
          <div className="flex items-center gap-4 ml-4 flex-1">
            <div className="relative flex-1 max-w-md lg:max-w-xl">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search certificates..."
                className="pl-8 bg-muted/50"
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </header>

        <main className="p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Insurance Certificates</h1>
            <p className="text-muted-foreground">
              Manage your insurance certificates and coverage
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading certificates...</p>
            </div>
          ) : certificates.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t purchased any insurance certificates yet.
                </p>
                <Button onClick={() => window.location.href = "/insurance/quotes"}>
                  Get Insurance Quote
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Order Number</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Product</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Coverage</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Premium</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Status</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Purchased</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Actions</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {certificates.map((certificate) => (
                      <tr 
                        key={certificate.id} 
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">{certificate.order_number || "N/A"}</div>
                          {certificate.certificate_number && (
                            <div className="text-xs text-gray-500">
                              {certificate.certificate_number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{certificate.product_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">
                            {formatCurrency(certificate.coverage_limit, certificate.currency)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Deductible: {formatCurrency(certificate.deductible, certificate.currency)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">
                            {formatCurrency(certificate.total_cost, certificate.currency)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(certificate.status)}
                          {certificate.cancelled_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(certificate.cancelled_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {new Date(certificate.purchased_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(certificate.purchased_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {(certificate.status === "ACTIVE" || certificate.status === "active") && (
                              <>
                                {certificate.certificate_link && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => downloadCertificate(certificate)}
                                    title="Download Certificate"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openCancelDialog(certificate)}
                                  title="Cancel Certificate"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {certificate.status === "CANCELLED" && certificate.cancellation_reason && (
                              <span className="text-xs text-gray-500">
                                {certificate.cancellation_reason}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </SidebarInset>

      {/* Cancel Certificate Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Insurance Certificate</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this certificate? This action may be irreversible.
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label>Certificate Number</Label>
              <p className="text-sm font-medium">
                {selectedCertificate?.certificate_number?.startsWith("CERT-") 
                  ? selectedCertificate.certificate_number 
                  : `CERT-${selectedCertificate?.id?.substring(0, 7).toUpperCase()}`}
              </p>
            </div>

            <div>
              <Label htmlFor="reason">Cancellation Reason</Label>
              <Select
                value={cancellationForm.reason}
                onValueChange={(value) => 
                  setCancellationForm({ ...cancellationForm, reason: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CANNLN">Certificate no longer needed</SelectItem>
                  <SelectItem value="CANPIE">Certificate purchased in error</SelectItem>
                  <SelectItem value="CANCHP">Cheaper insurance found elsewhere</SelectItem>
                  <SelectItem value="CANVAL">Insured value changed</SelectItem>
                  <SelectItem value="CANREQ">Insurance was not required</SelectItem>
                  <SelectItem value="CANCOP">Shipment lost to competition</SelectItem>
                  <SelectItem value="CANREP">Origin/Destination/Commodity Changed</SelectItem>
                  <SelectItem value="CANOTH">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {cancellationForm.reason === "CANOTH" && (
              <div>
                <Label htmlFor="additionalInfo">Additional Information</Label>
                <Textarea
                  id="additionalInfo"
                  placeholder="Please provide more details..."
                  value={cancellationForm.additionalInfo}
                  onChange={(e) => 
                    setCancellationForm({ ...cancellationForm, additionalInfo: e.target.value })
                  }
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
            >
              Keep Certificate
            </Button>
            <Button
              variant="destructive"
              onClick={cancelCertificate}
              disabled={cancelling || !cancellationForm.reason}
            >
              {cancelling ? "Cancelling..." : "Cancel Certificate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

export default function InsuranceCertificatesPage() {
  return (
    <AuthGuard>
      <InsuranceCertificatesContent />
    </AuthGuard>
  )
}
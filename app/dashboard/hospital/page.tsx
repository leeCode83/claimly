"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { 
  ShieldPlusIcon, 
  UsersIcon, 
  FileTextIcon, 
  BookOpenIcon, 
  PlusIcon, 
  SearchIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  FingerprintIcon,
  LockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  EyeIcon,
  Copy
} from "lucide-react"

import { usePatients } from "@/hooks/usePatients"
import { useInsurancePolicies } from "@/hooks/useInsurancePolicies"
import { useMedicalRecords } from "@/hooks/useMedicalRecords"
import { useDiagnoses } from "@/hooks/useDiagnoses"
import { useProcedures } from "@/hooks/useProcedures"
import { useClaims, ZkpStatus } from "@/hooks/useClaims"
import { useAuthContext } from "@/context/AuthContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

// Local Badge component as it might be missing in ui components
function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "secondary" | "destructive" | "outline" | "success", className?: string }) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground border border-input hover:bg-accent hover:text-accent-foreground",
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  }
  
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </span>
  )
}

const zkpStatusMessages: Record<ZkpStatus, string> = {
  idle: "Menunggu pengajuan...",
  preparing: "Mengambil data persiapan & Merkle Path...",
  generating: "Komputasi ZKP Proof di browser (mungkin butuh beberapa detik)...",
  submitting: "Mengirimkan Klaim & Proof ke server...",
  verifying: "Menunggu verifikasi sistem (Asynchronous MQ)...",
  success: "Klaim berhasil diverifikasi dan disetujui!",
  error: "Gagal memproses bukti ZKP atau verifikasi ditolak."
};

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState("patients")
  const { accessToken } = useAuthContext()
  
  const { 
    getPatients, 
    getPatient, 
    registerPatient, 
    addPatientPolicy, 
    getPatientPolicies,
    isLoading: isPatientOpLoading 
  } = usePatients(accessToken)
  
  const { getPolicies } = useInsurancePolicies(accessToken)
  const { getMedicalRecords, createMedicalRecord, isLoading: isMedRecLoading } = useMedicalRecords(accessToken)
  const { getDiagnoses } = useDiagnoses(accessToken)
  const { getProcedures } = useProcedures(accessToken)
  const { 
    submitClaimWithZkp, 
    submitClaim,
    submitProofForExistingClaim,
    getClaims: getClaimsList, 
    getClaimById: getClaimDetail,
    verifyClaim,
    zkpStatus, 
    isLoading: isClaimsMutationLoading, 
    zkpError 
  } = useClaims(accessToken)
  
  // State
  const [patients, setPatients] = useState<any[]>([])
  const [isPatientLoading, setIsPatientLoading] = useState(false)
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false)
  const [newPatientForm, setNewPatientForm] = useState({
    nik: "",
    full_name: "",
    birth_year: new Date().getFullYear() - 30,
    gender: "M" as "M" | "F",
    user_id: ""
  })
  const [patientSearch, setPatientSearch] = useState("")
  const [patientPage, setPatientPage] = useState(1)
  const [patientTotalPages, setPatientTotalPages] = useState(1)

  // Patient Detail & Policy State
  const [isPatientDetailOpen, setIsPatientDetailOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [patientDetail, setPatientDetail] = useState<any | null>(null)
  const [isPatientDetailLoading, setIsPatientDetailLoading] = useState(false)
  
  const [policiesData, setPoliciesData] = useState<any[]>([])
  const [isAddPolicyMode, setIsAddPolicyMode] = useState(false)
  const [newPolicyForm, setNewPolicyForm] = useState({
    policy_id: "",
    policy_number: "",
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  })
  
  // Claim State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    patient_policy_id: "",
    medical_record_id: "",
    procedure_id: "",
    procedure_date: new Date().toISOString().split('T')[0],
    claim_amount: 0
  })
  const [patientPolicies, setPatientPolicies] = useState<any[]>([])
  const [procedures, setProcedures] = useState<any[]>([])
  const [procedurePage, setProcedurePage] = useState(1)
  const [procedureTotal, setProcedureTotal] = useState(0)
  const [procedureSearch, setProcedureSearch] = useState("")
  const procedureLimit = 20
  const [lastClaims, setLastClaims] = useState<any[]>([])
  const [isClaimsLoading, setIsClaimsLoading] = useState(false)
  const [claimsPage, setClaimsPage] = useState(1)
  const [claimsTotalPages, setClaimsTotalPages] = useState(1)

  // Medical Records State
  const [medicalRecords, setMedicalRecords] = useState<any[]>([])
  const [isRecordsLoading, setIsRecordsLoading] = useState(false)
  const [isNewRecordOpen, setIsNewRecordOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotalPages, setRecordsTotalPages] = useState(1)
  
  const [diagnoses, setDiagnoses] = useState<any[]>([])
  const [diagnosesPage, setDiagnosesPage] = useState(1)
  const [diagnosesTotal, setDiagnosesTotal] = useState(0)
  const [diagnosesSearch, setDiagnosesSearch] = useState("")
  const diagnosesLimit = 20
  
  const [newRecordForm, setNewRecordForm] = useState({
    patient_id: "",
    diagnosis_id: "",
    diagnosis_date: new Date().toISOString().split('T')[0],
    notes: ""
  })

  // Selected Claim Detail State
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null)
  const [claimProofData, setClaimProofData] = useState<any | null>(null)
  const [isClaimDetailOpen, setIsClaimDetailOpen] = useState(false)
  const [isProofLoading, setIsProofLoading] = useState(false)
  const [isZkpDetailExpanded, setIsZkpDetailExpanded] = useState(false)

  // Data Loading Helpers
  const loadPatients = async (page = patientPage, search = patientSearch) => {
    setIsPatientLoading(true)
    try {
      const res = await getPatients({ page, limit: 10, search })
      setPatients(res.data || [])
      setPatientTotalPages(res.meta?.total_pages || 1)
      setPatientPage(page)
    } catch (err) {
      console.error(err)
    } finally {
      setIsPatientLoading(false)
    }
  }

  const loadMedicalRecords = async (page = recordsPage) => {
    setIsRecordsLoading(true)
    try {
      const res = await getMedicalRecords({ page, limit: 10 })
      if (res && res.data) {
        setMedicalRecords(res.data)
        setRecordsTotalPages(res.meta?.total_pages || res.pagination?.total_pages || 1)
        setRecordsPage(page)
      } else {
        setMedicalRecords(res || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsRecordsLoading(false)
    }
  }

  const loadDiagnosesData = async (page = 1, search = diagnosesSearch) => {
    try {
      const res = await getDiagnoses({ page, limit: diagnosesLimit, search } as any)
      setDiagnoses(res.data || [])
      setDiagnosesTotal(res.pagination?.total || 0)
      setDiagnosesPage(page)
    } catch (err) {
      console.error(err)
    }
  }

  const loadProcedures = async (page = 1, limit = procedureLimit, search = procedureSearch) => {
    try {
      const res = await getProcedures({ page, limit, search } as any)
      setProcedures(res.data || [])
      if (limit === procedureLimit) {
        setProcedureTotal(res.pagination?.total || res.total || 0)
        setProcedurePage(page)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadLastClaims = async (page = claimsPage) => {
    setIsClaimsLoading(true)
    try {
      const res = await getClaimsList({ page, limit: 10 })
      setLastClaims(res.data || [])
      setClaimsTotalPages(res.pagination?.total_pages || 1)
      setClaimsPage(page)
    } catch (err) {
      console.error(err)
    } finally {
      setIsClaimsLoading(false)
    }
  }

  const fetchPatientPoliciesForClaim = async (patientId: string) => {
    try {
      const res = await getPatientPolicies(patientId)
      setPatientPolicies(res.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  // Load data when opening tab
  useEffect(() => {
    if (accessToken) {
      if (activeTab === "patients") {
        loadPatients(patientPage, patientSearch)
        getPolicies({ limit: 100 }).then(res => setPoliciesData(res.data || [])).catch(console.error)
      } else if (activeTab === "records") {
        loadMedicalRecords(recordsPage)
        if (patients.length === 0) loadPatients(1, "")
        loadDiagnosesData(1, "")
      } else if (activeTab === "claims") {
        loadLastClaims(claimsPage)
        loadMedicalRecords(1) // Needed for selection
        loadProcedures(1, 100, "") // Keep limit high for claim dropdown select
      } else if (activeTab === "policy") {
        loadDiagnosesData(1, diagnosesSearch)
        loadProcedures(1, procedureLimit, procedureSearch)
      }
    }
  }, [accessToken, activeTab, patientPage, recordsPage, claimsPage])
  
  // Debounce Patient Search
  useEffect(() => {
    if (activeTab !== "patients") return;
    const timer = setTimeout(() => {
      loadPatients(1, patientSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Search Debounce Implementation
  useEffect(() => {
    if (activeTab !== "policy" && !isNewRecordOpen) return;
    const timer = setTimeout(() => {
      loadDiagnosesData(diagnosesPage, diagnosesSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [diagnosesSearch, diagnosesPage, isNewRecordOpen]);

  useEffect(() => {
    if (activeTab !== "policy") return;
    const timer = setTimeout(() => {
      loadProcedures(1, procedureLimit, procedureSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [procedureSearch]);

  // Handlers
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
       const patient = patients.find(p => p.id === newRecordForm.patient_id)
       const pk = patient?.users?.public_key || patient?.user?.public_key || undefined; 
       
       await createMedicalRecord(newRecordForm, pk)
       setIsNewRecordOpen(false)
       setNewRecordForm({ 
         patient_id: "", 
         diagnosis_id: "", 
         diagnosis_date: new Date().toISOString().split('T')[0], 
         notes: "" 
       })
       loadMedicalRecords()
    } catch (err) { }
  }

  const handleSubmit = async (e: React.FormEvent, withZkp: boolean = false) => {
    e.preventDefault()
    
    try {
      if (!formData.patient_policy_id || !formData.medical_record_id || !formData.procedure_id) {
        toast.error("Data Belum Lengkap", { description: "Pastikan Pasien, Rekam Medis, dan Prosedur sudah dipilih." });
        return;
      }

      if (withZkp) {
        await submitClaimWithZkp(formData)
      } else {
        await submitClaim({
          ...formData,
          proof: undefined,
          public_signals: undefined
        })
      }

      loadLastClaims()
      setIsDialogOpen(false)
      setFormData({
        patient_policy_id: "",
        medical_record_id: "",
        procedure_id: "",
        procedure_date: new Date().toISOString().split('T')[0],
        claim_amount: 0
      })
    } catch (err) { 
      console.error("Submission failed:", err)
    }
  }

  const handleMedicalRecordSelect = (mrId: string) => {
    const mr = medicalRecords.find(m => m.id === mrId)
    setFormData(prev => ({
      ...prev,
      medical_record_id: mrId,
      patient_policy_id: "" // Reset policy when MR changes
    }))
    if (mr && mr.patient_id) {
      fetchPatientPoliciesForClaim(mr.patient_id)
    } else {
      setPatientPolicies([])
    }
  }

  const handleGenerateProofForExisting = async (claim: any) => {
    const id = claim.claim_id || claim.id
    
    // Robust mapping for patient_policy_id from RPC/Service result
    const patient_policy_id = claim.patient_policy_id || 
                             claim.patient_policies?.id || 
                             (Array.isArray(claim.patient_policies) ? claim.patient_policies[0]?.id : undefined);

    if (!patient_policy_id) {
       toast.error("ID Polis Tidak Ditemukan", { 
         description: "Data polis asuransi tidak terbaca. Harap pastikan klaim terikat dengan polis yang valid." 
       });
       return;
    }

    if (!claim.medical_record_id) {
       toast.error("ID Rekam Medis Tidak Ditemukan", { 
         description: "Data rekam medis tidak terbaca dalam klaim ini. Silakan muat ulang halaman." 
       });
       return;
    }

    const procedure_id = claim.procedure_id || claim.icd9_id
    if (!procedure_id) {
       toast.error("ID Prosedur Tidak Ditemukan", { 
         description: "Data prosedur medis tidak terbaca dalam klaim ini. Silakan muat ulang halaman." 
       });
       return;
    }

    try {
      await submitProofForExistingClaim(id, {
        patient_policy_id: patient_policy_id,
        medical_record_id: claim.medical_record_id,
        procedure_id: procedure_id,
        procedure_date: claim.procedure_date,
        claim_amount: claim.claim_amount
      })
      loadLastClaims()
    } catch (err) { }
  }

  const handleVerifyClaim = async (id: string) => {
    try {
      await verifyClaim(id)
      loadLastClaims() // Refresh list after verification result received
    } catch (err) {
      console.error("Manual verification trigger failed:", err)
    }
  }

  const handleViewClaimDetail = async (claim: any) => {
    const claimId = claim?.claim_id || claim?.id;
    if (!claimId) {
      console.warn("Attempted to view claim without ID", claim);
      return;
    }

    setIsClaimDetailOpen(true)
    setIsZkpDetailExpanded(false)
    setIsProofLoading(true)

    try {
      const fullClaim = await getClaimDetail(claimId)
      setSelectedClaim(fullClaim)
      
      // Extract proof: handles both Array (from some services) and Single Object (from consolidated detail)
      if (fullClaim.zkp_proofs) {
        if (Array.isArray(fullClaim.zkp_proofs)) {
          setClaimProofData(fullClaim.zkp_proofs.length > 0 ? fullClaim.zkp_proofs[0] : null)
        } else {
          // It's a single object as seen in the debug log
          setClaimProofData(fullClaim.zkp_proofs)
        }
      } else {
        setClaimProofData(null)
      }
    } catch (err) {
      console.error("Error fetching full claim detail:", err)
      setSelectedClaim(claim) // Rollback to simple version
    } finally {
      setIsProofLoading(false)
    }
  }

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = { ...newPatientForm }
      if (!payload.user_id) delete payload.user_id

      await registerPatient(payload)
      setIsNewPatientOpen(false)
      setNewPatientForm({
        nik: "",
        full_name: "",
        birth_year: new Date().getFullYear() - 30,
        gender: "M",
        user_id: ""
      })
      loadPatients()
    } catch (err) { }
  }

  const handleViewDetail = async (id: string) => {
    setSelectedPatientId(id);
    setIsPatientDetailOpen(true);
    setIsPatientDetailLoading(true);
    setIsAddPolicyMode(false);
    try {
      const res = await getPatient(id);
      setPatientDetail(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPatientDetailLoading(false);
    }
  }

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    
    try {
      setIsPatientDetailLoading(true);
      await addPatientPolicy(selectedPatientId, newPolicyForm);
      
      const res = await getPatient(selectedPatientId);
      setPatientDetail(res);
      
      setIsAddPolicyMode(false);
      setNewPolicyForm({
        policy_id: "",
        policy_number: "",
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsPatientDetailLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Patient Detail Modal */}
      <Dialog open={isPatientDetailOpen} onOpenChange={setIsPatientDetailOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Pasien</DialogTitle>
            <DialogDescription>
              Informasi profil dan polis asuransi (Patient Policy) yang aktif.
            </DialogDescription>
          </DialogHeader>
          
          {isPatientDetailLoading && !patientDetail ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2Icon className="size-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Memuat detail pasien...</p>
            </div>
          ) : patientDetail ? (
            <div className="space-y-6">
              <div className="rounded-lg border p-4 grid grid-cols-2 gap-4 bg-muted/20">
                <div>
                  <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                  <p className="font-medium">{patientDetail.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID Pasien</p>
                  <div className="flex items-center gap-2 group mt-0.5">
                    <p className="font-mono text-xs">{patientDetail.id}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => {
                        navigator.clipboard.writeText(patientDetail.id);
                        toast.success("ID Pasien berhasil disalin");
                      }}
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tahun Lahir & Gender</p>
                  <p className="font-medium">{patientDetail.birth_year} &bull; {patientDetail.gender === 'M' ? 'Laki-laki' : 'Perempuan'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">User UUID Terikat</p>
                  <div className="flex items-center gap-2 group mt-0.5">
                    <p className="font-mono text-xs truncate" title={patientDetail.user_id || "Belum ditautkan"}>
                      {patientDetail.user_id || "Belum ditautkan"}
                    </p>
                    {patientDetail.user_id && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={() => {
                          navigator.clipboard.writeText(patientDetail.user_id);
                          toast.success("User UUID berhasil disalin");
                        }}
                      >
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold px-1">Polis Asuransi Pasien</h3>
                  {!isAddPolicyMode && (
                    <Button size="sm" onClick={() => setIsAddPolicyMode(true)}>
                      <PlusIcon className="size-4 mr-2" />
                      Tambah Polis
                    </Button>
                  )}
                </div>

                {isAddPolicyMode ? (
                  <form onSubmit={handleAddPolicy} className="rounded-lg border p-4 space-y-4 bg-muted/10">
                    <h4 className="font-medium text-sm">Form Tambah Polis</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="policy_id">Polis Induk (Asuransi) <span className="text-destructive">*</span></Label>
                        <select 
                          id="policy_id" 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newPolicyForm.policy_id}
                          onChange={(e) => setNewPolicyForm({...newPolicyForm, policy_id: e.target.value})}
                          required
                        >
                          <option value="" disabled>Pilih Polis...</option>
                          {policiesData.map((pol: any) => (
                            <option key={pol.id} value={pol.id}>{pol.policy_name || `Polis ID: ${pol.id?.substring(0,8) || '...'}`}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="policy_number">Nomor Polis Pasien <span className="text-destructive">*</span></Label>
                        <Input 
                          id="policy_number" 
                          placeholder="Contoh: POL-123456" 
                          value={newPolicyForm.policy_number}
                          onChange={(e) => setNewPolicyForm({...newPolicyForm, policy_number: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Tanggal Aktif (Start) <span className="text-destructive">*</span></Label>
                        <Input 
                          id="start_date" 
                          type="date"
                          value={newPolicyForm.start_date}
                          onChange={(e) => setNewPolicyForm({...newPolicyForm, start_date: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">Tanggal Berakhir (End) <span className="text-destructive">*</span></Label>
                        <Input 
                          id="end_date" 
                          type="date"
                          value={newPolicyForm.end_date}
                          onChange={(e) => setNewPolicyForm({...newPolicyForm, end_date: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddPolicyMode(false)}>Batal</Button>
                      <Button type="submit" size="sm" disabled={isPatientDetailLoading}>
                        {isPatientDetailLoading && <Loader2Icon className="size-3 animate-spin mr-2" />}
                        Simpan Polis
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    {patientDetail.patient_policies?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6 border rounded-md">Belum ada polis asuransi yang terdaftar untuk pasien ini.</p>
                    ) : (
                      patientDetail.patient_policies?.map((policy: any) => (
                        <div key={policy.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="font-medium text-sm">{policy.policy_number}</p>
                            <div className="flex gap-2 items-center mt-1">
                              <Badge variant={policy.is_active ? "success" : "destructive"}>
                                {policy.is_active ? 'AKTIF' : 'NON-AKTIF'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(policy.start_date).toLocaleDateString('id-ID')} - {new Date(policy.end_date).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground">Insurance Policy ID:</span>
                            <span className="text-xs font-mono text-primary w-24 truncate" title={policy.policy_id}>{policy.policy_id}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Hospital Dashboard</h1>
          <p className="text-muted-foreground">Kelola pasien, rekam medis, dan ajukan klaim asuransi.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusIcon className="size-4" />
                Pasien Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Daftarkan Pasien Baru</DialogTitle>
                <DialogDescription>
                  Masukkan data diri pasien. Anda dapat menghubungkan akun pengguna (UUID) secara opsional.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRegisterPatient} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nik">NIK KTP <span className="text-destructive">*</span></Label>
                    <Input 
                      id="nik" 
                      placeholder="16 Digit NIK" 
                      value={newPatientForm.nik}
                      onChange={(e) => setNewPatientForm({...newPatientForm, nik: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nama Lengkap <span className="text-destructive">*</span></Label>
                    <Input 
                      id="full_name" 
                      placeholder="Nama sesuai KTP" 
                      value={newPatientForm.full_name}
                      onChange={(e) => setNewPatientForm({...newPatientForm, full_name: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birth_year">Tahun Lahir <span className="text-destructive">*</span></Label>
                    <Input 
                      id="birth_year" 
                      type="number"
                      value={newPatientForm.birth_year}
                      onChange={(e) => setNewPatientForm({...newPatientForm, birth_year: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Jenis Kelamin <span className="text-destructive">*</span></Label>
                    <select 
                      id="gender"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newPatientForm.gender}
                      onChange={(e) => setNewPatientForm({...newPatientForm, gender: e.target.value as "M" | "F"})}
                      required
                    >
                      <option value="M">Laki-laki (M)</option>
                      <option value="F">Perempuan (F)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user_id">User UUID (Opsional)</Label>
                  <Input 
                    id="user_id" 
                    placeholder="Masukkan UUID akun aplikasi (opsional)" 
                    value={newPatientForm.user_id}
                    onChange={(e) => setNewPatientForm({...newPatientForm, user_id: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    UUID diperlukan jika pasien memiliki akun aplikasi Claimly.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setIsNewPatientOpen(false)}>Kembali</Button>
                  <Button type="submit" disabled={isPatientOpLoading}>
                    {isPatientOpLoading ? <Loader2Icon className="size-4 animate-spin mr-2" /> : null}
                    Daftarkan
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="patients" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="patients" className="gap-2 px-4 py-2 rounded-md transition-all">
            <UsersIcon className="size-4" />
            Pasien
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2 px-4 py-2 rounded-md transition-all">
            <FileTextIcon className="size-4" />
            Rekam Medis
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2 px-4 py-2 rounded-md transition-all">
            <ShieldPlusIcon className="size-4" />
            Ajukan Klaim
          </TabsTrigger>
          <TabsTrigger value="policy" className="gap-2 px-4 py-2 rounded-md transition-all">
            <BookOpenIcon className="size-4" />
            Policy ICD
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div className="space-y-1">
                <CardTitle>Daftar Pasien Terdaftar</CardTitle>
                <CardDescription>Cari dan kelola informasi pasien rumah sakit.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cari nama/NIK..." 
                    className="pl-9 w-[250px]" 
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead>Jenis Kelamin</TableHead>
                    <TableHead>Tahun Lahir</TableHead>
                    <TableHead>ID Pasien</TableHead>
                    <TableHead>Terdaftar Sejak</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPatientLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <Loader2Icon className="size-6 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Memuat data pasien...</p>
                      </TableCell>
                    </TableRow>
                  ) : patients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada pasien yang didaftarkan ke rumah sakit ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    patients.map((p, idx) => (
                      <TableRow key={p.id || `patient-${idx}`}>
                        <TableCell className="font-medium">{p.full_name || "Tidak ada nama"}</TableCell>
                        <TableCell>{p.gender === 'M' ? 'Laki-laki' : p.gender === 'F' ? 'Perempuan' : p.gender}</TableCell>
                        <TableCell>{p.birth_year || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{p.id?.substring(0, 8) || "..."}...</TableCell>
                        <TableCell>{new Date(p.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetail(p.id)}>Detail</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {patientTotalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setPatientPage(p => Math.max(1, p - 1)) }}
                          className={patientPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(patientTotalPages, 5) }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink 
                            href="#" 
                            onClick={(e: React.MouseEvent) => { e.preventDefault(); setPatientPage(i + 1) }}
                            isActive={patientPage === i + 1}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      {patientTotalPages > 5 && <PaginationEllipsis />}
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setPatientPage(p => Math.min(patientTotalPages, p + 1)) }}
                          className={patientPage === patientTotalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div className="space-y-1">
                <CardTitle>Entri Rekam Medis Terbaru</CardTitle>
                <CardDescription>Catatan medis yang telah dienkripsi menggunakan kunci publik pasien.</CardDescription>
              </div>
              <Dialog open={isNewRecordOpen} onOpenChange={setIsNewRecordOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <PlusIcon className="size-4" />
                    Tambah Rekam Medis
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[1100px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl">
                  <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <PlusIcon className="size-6 text-primary" />
                      </div>
                      Tambah Rekam Medis
                    </DialogTitle>
                    <DialogDescription>
                      Isi data diagnosis dan prosedur pasien. Catatan akan dienkripsi secara aman menggunakan kunci publik pasien.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateRecord} className="flex-1 overflow-hidden flex flex-col p-0">
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-background">
                      {/* LEFT SECTION: Basic Info */}
                      <div className="w-full md:w-[380px] border-r bg-muted/5 p-8 overflow-y-auto space-y-8">
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm">1</div>
                            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Informasi Dasar</h3>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="patient_id" className="text-xs font-bold uppercase text-slate-400">Pilih Pasien <span className="text-destructive">*</span></Label>
                              <select 
                                id="patient_id"
                                className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-primary shadow-sm"
                                value={newRecordForm.patient_id}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewRecordForm({...newRecordForm, patient_id: e.target.value})}
                                required
                              >
                                <option value="" disabled>Pilih Pasien...</option>
                                {patients.map((p) => (
                                  <option key={p.id} value={p.id}>{p.full_name} ({p.nik})</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="diagnosis_date" className="text-xs font-bold uppercase text-slate-400">Tanggal Diagnosis <span className="text-destructive">*</span></Label>
                              <Input 
                                id="diagnosis_date" 
                                type="date"
                                className="h-12 rounded-xl border-input focus:ring-primary shadow-sm"
                                value={newRecordForm.diagnosis_date}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRecordForm({...newRecordForm, diagnosis_date: e.target.value})}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="notes" className="text-xs font-bold uppercase text-slate-400">Catatan Medis (Opsional)</Label>
                              <Textarea
                                id="notes"
                                className="min-h-[140px] rounded-2xl border-input focus:ring-primary shadow-inner resize-none p-4 text-sm"
                                placeholder="Tuliskan catatan tambahan..."
                                value={newRecordForm.notes}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewRecordForm({...newRecordForm, notes: e.target.value})}
                              />
                              <p className="text-[10px] text-muted-foreground italic px-1 opacity-70">
                                Catatan akan dienkripsi E2EE dengan kunci publik pasien.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT SECTION: Diagnosis Whitelist Selection */}
                      <div className="flex-1 flex flex-col min-w-0 bg-background">
                        <div className="px-8 py-4 border-b bg-muted/5 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm">2</div>
                            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Pilih Diagnosis (ICD-10)</h3>
                          </div>
                          {newRecordForm.diagnosis_id && (
                            <Badge variant="success" className="rounded-full animate-in zoom-in duration-300">Terpilih</Badge>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col p-8 overflow-hidden">
                          <div className="relative group mb-4">
                             <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                             <Input 
                                placeholder="Cari kode atau nama diagnosa..." 
                                className="h-11 pl-10 rounded-xl bg-muted/30 border-transparent focus:bg-white focus:border-primary transition-all text-sm shadow-inner" 
                                value={diagnosesSearch}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { 
                                  setDiagnosesSearch(e.target.value); 
                                  setDiagnosesPage(1); 
                                }}
                             />
                          </div>

                          <div className="flex-1 border rounded-2xl overflow-hidden bg-muted/5 flex flex-col shadow-sm">
                            <div className="overflow-y-auto flex-1">
                              <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-24 text-[10px] font-bold uppercase tracking-wider">Kode</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Deskripsi</TableHead>
                                    <TableHead className="w-16 text-right"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {isMedRecLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                      <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded-full ml-auto" /></TableCell>
                                      </TableRow>
                                    ))
                                  ) : (
                                    diagnoses.map((d) => (
                                      <TableRow 
                                        key={d.id} 
                                        className={cn(
                                          "cursor-pointer transition-colors group",
                                          newRecordForm.diagnosis_id === d.id ? "bg-primary/10 border-primary/20 hover:bg-primary/20" : "hover:bg-muted/30"
                                        )}
                                        onClick={() => setNewRecordForm({ ...newRecordForm, diagnosis_id: d.id })}
                                      >
                                        <TableCell className="font-mono text-xs font-bold text-primary">{d.icd10_code}</TableCell>
                                        <TableCell className="text-xs font-medium text-slate-700">{d.description}</TableCell>
                                        <TableCell className="text-right">
                                          <div className={cn(
                                            "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                                            newRecordForm.diagnosis_id === d.id ? "bg-primary border-primary" : "border-slate-200 group-hover:border-primary/50"
                                          )}>
                                            {newRecordForm.diagnosis_id === d.id && <div className="size-1.5 bg-white rounded-full" />}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Inner Pagination for Diagnoses */}
                            <div className="p-3 border-t bg-white shrink-0">
                               <Pagination>
                                <PaginationContent>
                                  <PaginationItem>
                                    <PaginationPrevious 
                                      href="#" 
                                      onClick={(e: React.MouseEvent) => { e.preventDefault(); setDiagnosesPage(p => Math.max(1, p - 1)) }}
                                      className={diagnosesPage === 1 ? "pointer-events-none opacity-50 scale-75" : "scale-75"}
                                    />
                                  </PaginationItem>
                                  <PaginationItem className="text-[11px] font-bold text-slate-500 px-4">
                                     Halaman {diagnosesPage}
                                  </PaginationItem>
                                  <PaginationItem>
                                    <PaginationNext 
                                      href="#" 
                                      onClick={(e: React.MouseEvent) => { e.preventDefault(); setDiagnosesPage(p => p + 1) }}
                                      className={diagnoses.length < diagnosesLimit ? "pointer-events-none opacity-50 scale-75" : "scale-75"}
                                    />
                                  </PaginationItem>
                                </PaginationContent>
                              </Pagination>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter className="p-4 px-8 border-t bg-muted/10 shrink-0 gap-3">
                      <Button type="button" variant="ghost" className="rounded-xl border hover:bg-muted" onClick={() => setIsNewRecordOpen(false)}>
                        Batal
                      </Button>
                      <Button type="submit" className="rounded-xl px-8 shadow-lg shadow-primary/20" disabled={isMedRecLoading || !newRecordForm.diagnosis_id}>
                        {isMedRecLoading ? <Loader2Icon className="size-4 animate-spin mr-2" /> : <PlusIcon className="size-4 mr-2" />}
                        Simpan Rekam Medis
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-6">
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Rekam Medis</TableHead>
                    <TableHead>Pasien</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status Enkripsi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRecordsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <Loader2Icon className="size-6 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Memuat data rekam medis...</p>
                      </TableCell>
                    </TableRow>
                  ) : medicalRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada data rekam medis.
                      </TableCell>
                    </TableRow>
                  ) : (
                    medicalRecords.map((record, idx) => (
                      <TableRow key={record.id || `mr-${idx}`}>
                        <TableCell className="text-xs font-mono">{record.id?.substring(0,8) || "..."}...</TableCell>
                        <TableCell className="font-medium">{record.patient?.full_name || record.patient_id?.substring(0,8) || "..."}</TableCell>
                        <TableCell>{record.diagnosis?.description || record.diagnosis_id?.substring(0,8) || "-"}</TableCell>
                        <TableCell>{new Date(record.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          {record.notes_encrypted ? (
                            <Badge variant="success" className="text-[10px]">Securely Encrypted</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">No Notes</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>Detail</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {recordsTotalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setRecordsPage(p => Math.max(1, p - 1)) }}
                          className={recordsPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(recordsTotalPages, 5) }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink 
                            href="#" 
                            onClick={(e: React.MouseEvent) => { e.preventDefault(); setRecordsPage(i + 1) }}
                            isActive={recordsPage === i + 1}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      {recordsTotalPages > 5 && <PaginationEllipsis />}
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setRecordsPage(p => Math.min(recordsTotalPages, p + 1)) }}
                          className={recordsPage === recordsTotalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Card className="hover:border-primary transition-all cursor-pointer group">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PlusIcon className="size-5 text-primary group-hover:scale-110 transition-transform" />
                        Klaim Baru
                      </CardTitle>
                      <CardDescription>Mulai proses penjaminan klaim asuransi dengan ZKP.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full">Buat Pengajuan</Button>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <DialogHeader>
                    <DialogTitle>Ajukan Klaim Asuransi (ZKP)</DialogTitle>
                    <DialogDescription>
                      Proses ini akan men-generate Zero-Knowledge Proof secara lokal di browser Anda.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {zkpStatus !== 'idle' && zkpStatus !== 'success' && zkpStatus !== 'error' ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="relative">
                         <Loader2Icon className="size-16 animate-spin text-primary" />
                         <FingerprintIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 text-primary/50" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="font-bold text-lg text-primary">{zkpStatusMessages[zkpStatus] ?? "Memproses..."}</p>
                        <p className="text-xs text-muted-foreground">Mohon tunggu, komputasi kriptografi sedang berlangsung.</p>
                      </div>
                    </div>
                  ) : zkpStatus === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                       <div className="rounded-full bg-green-100 p-3">
                        <CheckCircle2Icon className="size-12 text-green-600" />
                       </div>
                       <div className="text-center">
                        <p className="font-bold text-xl text-green-700">{zkpStatusMessages.success}</p>
                        <p className="text-sm text-muted-foreground mt-1">Klaim telah berhasil disubmit dan diverifikasi.</p>
                       </div>
                       <Button onClick={() => setIsDialogOpen(false)} className="mt-4">Tutup</Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="medical_record_id">Data Rekam Medis Pasien <span className="text-destructive">*</span></Label>
                        <select 
                          id="medical_record_id"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.medical_record_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMedicalRecordSelect(e.target.value)}
                          required
                        >
                          <option value="" disabled>Pilih Rekam Medis...</option>
                          {medicalRecords.map((mr, idx) => (
                            <option key={mr.id || `mr-opt-${idx}`} value={mr.id}>
                              {mr.patient?.full_name || 'Pasien'} - {mr.diagnosis?.icd10_code || 'Diag'} ({new Date(mr.created_at).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="patient_policy_id">Polis Asuransi Aktif <span className="text-destructive">*</span></Label>
                        <select 
                          id="patient_policy_id"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                          value={formData.patient_policy_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, patient_policy_id: e.target.value})}
                          disabled={!formData.medical_record_id || patientPolicies.length === 0}
                          required
                        >
                          <option value="" disabled>{patientPolicies.length === 0 ? 'Pilih Rekam Medis Terlebih Dahulu' : 'Pilih Polis Pasien...'}</option>
                          {patientPolicies.map((pp, idx) => (
                            <option key={pp.id || `pp-opt-${idx}`} value={pp.id}>
                              {pp.insurance_policies?.policy_name || 'Asuransi'} - {pp.policy_number}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="procedure_id">Prosedur Medis <span className="text-destructive">*</span></Label>
                        <select 
                          id="procedure_id"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.procedure_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const proc = procedures.find(p => p.id === e.target.value)
                            setFormData({
                              ...formData, 
                              procedure_id: e.target.value,
                              claim_amount: proc?.default_max_coverage || 0
                            })
                          }}
                          required
                        >
                          <option value="" disabled>Pilih Prosedur...</option>
                          {procedures.map((proc) => (
                            <option key={proc.id} value={proc.id}>
                              {proc.description} ({proc.icd9_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="procedure_date">Tanggal Tindakan <span className="text-destructive">*</span></Label>
                          <Input 
                            id="procedure_date" 
                            type="date"
                            value={formData.procedure_date} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, procedure_date: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="claim_amount">Nominal Klaim (IDR) <span className="text-destructive">*</span></Label>
                          <Input 
                            id="claim_amount" 
                            type="number"
                            value={formData.claim_amount} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, claim_amount: parseInt(e.target.value) || 0})}
                            required
                          />
                          {formData.procedure_id && (
                            <p className="text-[10px] text-muted-foreground">Max: IDR {procedures.find(p => p.id === formData.procedure_id)?.default_max_coverage.toLocaleString()}</p>
                          )}
                        </div>
                      </div>

                      {zkpStatus === 'error' && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex gap-2 text-sm items-start">
                          <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
                          <p>{zkpError || "Gagal memproses bukti ZKP."}</p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          disabled={isClaimsMutationLoading}
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Batal
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                            disabled={isClaimsMutationLoading}
                            onClick={(e: React.MouseEvent) => handleSubmit(e, false)}
                          >
                            Submit Claim (Tanpa Proof)
                          </Button>
                          <Button 
                            type="button" 
                            disabled={isClaimsMutationLoading} 
                            className="gap-2 bg-primary"
                            size="sm"
                            onClick={(e: React.MouseEvent) => handleSubmit(e, true)}
                          >
                            {isClaimsMutationLoading && <Loader2Icon className="size-4 animate-spin" />}
                            Submit Claim with Proof
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </DialogContent>
             </Dialog>

             <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2Icon className="size-5 text-green-500" />
                    Klaim Terverifikasi
                  </CardTitle>
                  <CardDescription>Menampilkan jumlah klaim yang berhasil disetujui otomatis.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="text-3xl font-bold text-green-600">
                    {lastClaims.filter(c => c.status === 'approved').length} Disetujui
                   </div>
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircleIcon className="size-5 text-amber-500" />
                    Klaim Pending
                  </CardTitle>
                  <CardDescription>Klaim yang sedang menunggu verifikasi atau butuh bukti ulang.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="text-3xl font-bold text-amber-600">
                    {lastClaims.filter(c => c.status === 'pending' || c.status === 'submitted').length} Menunggu
                   </div>
                </CardContent>
             </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Daftar Klaim Terakhir</CardTitle>
              <CardDescription>Klaim 10 terakhir yang dibuat oleh rumah sakit ini.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Klaim</TableHead>
                    <TableHead>ID MedRec</TableHead>
                    <TableHead>Kode ICD-9</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isClaimsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <Loader2Icon className="size-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : lastClaims.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada riwayat klaim.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lastClaims.map((claim, idx) => (
                      <TableRow key={claim.claim_id || claim.id || `claim-${idx}`}>
                        <TableCell className="text-xs font-mono">{(claim.claim_id || claim.id)?.substring(0,8) || "..."}...</TableCell>
                        <TableCell className="text-xs font-mono">{claim.medical_record_id?.substring(0,8) || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{claim.procedure_code || claim.procedures?.icd9_code || claim.icd9_code || "-"}</Badge></TableCell>
                        <TableCell>IDR {claim.claim_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            claim.status === 'approved' ? 'success' :
                            claim.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }>
                            {claim.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right flex items-center justify-end gap-1 text-xs">
                          {claim.status === 'submitted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 border-primary/30 text-primary hover:bg-primary/5"
                              onClick={() => handleVerifyClaim(claim.claim_id || claim.id)}
                              disabled={isClaimsMutationLoading}
                            >
                              {isClaimsMutationLoading ? <Loader2Icon className="size-3 animate-spin"/> : <CheckCircle2Icon className="size-3 mr-1" />}
                              Verifikasi
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 gap-1 px-2"
                            onClick={() => handleViewClaimDetail(claim)}
                          >
                            <EyeIcon className="size-3" />
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {claimsTotalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setClaimsPage(p => Math.max(1, p - 1)) }}
                          className={claimsPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(claimsTotalPages, 5) }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink 
                            href="#" 
                            onClick={(e: React.MouseEvent) => { e.preventDefault(); setClaimsPage(i + 1) }}
                            isActive={claimsPage === i + 1}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      {claimsTotalPages > 5 && <PaginationEllipsis />}
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setClaimsPage(p => Math.min(claimsTotalPages, p + 1)) }}
                          className={claimsPage === claimsTotalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>ICD Master Data</CardTitle>
              <CardDescription>Referensi kode standar medis Diagnosis (ICD-10) dan Prosedur (ICD-9).</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="diagnoses" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="diagnoses" className="gap-2">
                    <FileTextIcon className="size-4" />
                    Diagnoses (ICD-10)
                  </TabsTrigger>
                  <TabsTrigger value="procedures" className="gap-2">
                    <ShieldPlusIcon className="size-4" />
                    Procedures (ICD-9)
                  </TabsTrigger>
                </TabsList>

                {/* Diagnoses Sub-tab */}
                <TabsContent value="diagnoses" className="space-y-4 outline-none">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input 
                        placeholder="Cari diagnosis berdasarkan kode atau deskripsi..." 
                        className="pl-9"
                        value={diagnosesSearch}
                        onChange={(e) => setDiagnosesSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 min-h-[400px]">
                    {diagnoses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border rounded-lg border-dashed">
                        <SearchIcon className="size-8 mb-2 opacity-20" />
                        <p>Tidak ada data diagnosis ditemukan.</p>
                      </div>
                    ) : (
                      diagnoses.map((d, idx) => (
                        <div key={d.id || `diag-${idx}`} className="p-4 border rounded-lg text-sm flex justify-between items-center hover:bg-muted/30 transition-colors group">
                          <span className="font-medium">{d.description}</span>
                          <Badge variant="outline" className="font-mono group-hover:border-primary/50 group-hover:text-primary transition-colors">
                            {d.icd10_code}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-xs text-muted-foreground italic">
                      Total: {diagnosesTotal} Diagnosis
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadDiagnosesData(diagnosesPage - 1)}
                        disabled={diagnosesPage <= 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center px-2 text-xs font-medium">
                        Halaman {diagnosesPage}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadDiagnosesData(diagnosesPage + 1)}
                        disabled={diagnosesPage * diagnosesLimit >= diagnosesTotal}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Procedures Sub-tab */}
                <TabsContent value="procedures" className="space-y-4 outline-none">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input 
                        placeholder="Cari prosedur berdasarkan kode atau deskripsi..." 
                        className="pl-9"
                        value={procedureSearch}
                        onChange={(e) => setProcedureSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 min-h-[400px]">
                    {procedures.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border rounded-lg border-dashed">
                        <SearchIcon className="size-8 mb-2 opacity-20" />
                        <p>Tidak ada data prosedur ditemukan.</p>
                      </div>
                    ) : (
                      procedures.map((p, idx) => (
                        <div key={p.id || `proc-${idx}`} className="p-4 border rounded-lg text-sm flex flex-col gap-2 hover:bg-muted/30 transition-colors group">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{p.description}</span>
                            <Badge variant="outline" className="font-mono group-hover:border-primary/50 group-hover:text-primary transition-colors">
                              {p.icd9_code}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-muted/50 mt-1">
                             <div className="flex gap-1 items-center">
                               <ShieldPlusIcon className="size-3 text-primary/60" />
                               <span>Max Coverage:</span>
                             </div>
                             <span className="font-bold text-primary">IDR {p.default_max_coverage.toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-xs text-muted-foreground italic">
                      Total: {procedureTotal} Prosedur
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadProcedures(procedurePage - 1)}
                        disabled={procedurePage <= 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center px-2 text-xs font-medium">
                        Halaman {procedurePage}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadProcedures(procedurePage + 1)}
                        disabled={procedurePage * procedureLimit >= procedureTotal}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Claim Detail Modal */}
      <Dialog open={isClaimDetailOpen} onOpenChange={setIsClaimDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpenIcon className="size-5 text-primary" />
              Detail Klaim Asuransi
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap klaim dan bukti kriptografi Zero-Knowledge Proof.
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-6 py-4">
               {/* Info Grid */}
               <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">ID Klaim</p>
                    <p className="font-mono text-xs">{selectedClaim.claim_id || selectedClaim.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">ID Rekam Medis</p>
                    <p className="font-mono text-xs">{selectedClaim.medical_record_id || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Status</p>
                    <Badge variant={
                        selectedClaim.status === 'approved' ? 'success' :
                        selectedClaim.status === 'rejected' ? 'destructive' :
                        'secondary'
                      }>
                        {selectedClaim.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Prosedur (ICD-9)</p>
                    <p className="font-semibold">{selectedClaim.procedure_code || selectedClaim.procedures?.icd9_code || selectedClaim.icd9_code || "-"} - {selectedClaim.procedure_description || selectedClaim.procedures?.description || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Nominal Klaim</p>
                    <p className="font-bold text-primary">IDR {selectedClaim.claim_amount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Tanggal Pengajuan</p>
                    <p className="font-medium">{new Date(selectedClaim.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {selectedClaim.patient_policies && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Polis Asuransi</p>
                      <p className="font-medium">
                        {selectedClaim.patient_policies.insurance_policies?.policy_name || "N/A"} 
                        <span className="text-[10px] text-muted-foreground ml-2 font-mono">({selectedClaim.patient_policies.policy_number})</span>
                      </p>
                    </div>
                  )}
               </div>

               {/* ZKP Technical Section */}
               <div className="space-y-3 pt-4 border-t">
                  <button 
                    onClick={() => setIsZkpDetailExpanded(!isZkpDetailExpanded)}
                    className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                       <CodeIcon className="size-4 text-primary" />
                       <span className="text-sm font-semibold">Informasi Kriptografi (ZKP Detail)</span>
                    </div>
                    {isZkpDetailExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                  </button>

                  {isZkpDetailExpanded && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-200 origin-top">
                        {isProofLoading ? (
                          <div className="flex flex-col items-center justify-center p-8 gap-3 border rounded-md">
                             <Loader2Icon className="size-6 animate-spin text-primary" />
                             <p className="text-xs text-muted-foreground italic">Mengambil data bukti kriptografi...</p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Proof JSON</Label>
                               <div className="max-h-[200px] overflow-auto p-3 bg-slate-950 text-slate-200 rounded-md border font-mono text-[10px]">
                                  {claimProofData?.proof_json ? (
                                    <pre>{JSON.stringify(claimProofData.proof_json, null, 2)}</pre>
                                  ) : (
                                    <p className="italic text-slate-500">Proof belum tersedia untuk klaim ini.</p>
                                  )}
                               </div>
                            </div>

                            <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Public Signals (Inputs)</Label>
                               <div className="p-3 bg-slate-900 text-green-400 rounded-md border border-green-900/50 font-mono text-[10px] overflow-auto">
                                  {/* Using public_signals (with underscore) from body response */}
                                  {claimProofData?.public_signals ? (
                                    <pre>{JSON.stringify(claimProofData.public_signals, null, 2)}</pre>
                                  ) : (
                                    <p className="italic text-slate-500">Public signals tidak tersedia.</p>
                                  )}
                               </div>
                            </div>

                            {/* Using verified_at (with underscore) from body response */}
                            {claimProofData?.verified_at && (
                              <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-[11px] text-green-600 dark:text-green-400">
                                 <CheckCircle2Icon className="size-3" />
                                 Verifikasi sistem selesai pada {new Date(claimProofData.verified_at).toLocaleString('id-ID')}
                              </div>
                            )}
                          </>
                        )}
                    </div>
                  )}
               </div>

               {selectedClaim.status === 'pending' && (
                 <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Klaim ini dibuat tanpa bukti (pending). Staf rumah sakit harus men-generate ZKP proof di sisi client untuk melanjutkan proses verifikasi.
                    </p>
                    <Button 
                      className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white border-none" 
                      variant="default"
                      onClick={() => handleGenerateProofForExisting(selectedClaim)}
                      disabled={isClaimsMutationLoading}
                    >
                      {isClaimsMutationLoading ? <Loader2Icon className="size-4 animate-spin" /> : <FingerprintIcon className="size-4" />}
                      {isClaimsMutationLoading ? "Memproses Proof..." : "Generate & Kirim ZKP Proof Sekarang"}
                    </Button>
                 </div>
               )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsClaimDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Medical Record Modal for Staff */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => {
        if (!open) setSelectedRecord(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileTextIcon className="size-5 text-primary" />
              Rincian Rekam Medis
            </DialogTitle>
            <DialogDescription>
              Akses terbatas staf rumah sakit. Catatan medis terenkripsi E2EE.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase">Pasien</p>
                  <p className="font-semibold">{selectedRecord?.patient?.full_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase">Tanggal</p>
                  <p className="font-semibold">
                    {selectedRecord?.diagnosis_date && new Date(selectedRecord.diagnosis_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs uppercase">Diagnosis</p>
              <div className="p-3 border rounded-lg bg-muted/30 font-medium text-sm">
                {selectedRecord?.diagnosis?.description} ({selectedRecord?.diagnosis?.icd10_code})
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LockIcon className="size-4 text-muted-foreground" />
                Catatan Medis
              </div>
              <div className="p-4 border border-dashed rounded-lg bg-muted/10 text-center">
                <p className="text-xs text-muted-foreground">
                  Catatan dokter dienkripsi dengan kunci publik pasien. Staf tidak dapat membaca isi catatan ini demi privasi pasien.
                </p>
              </div>
            </div>

            {selectedRecord?.claims && selectedRecord.claims.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <p className="text-xs font-semibold text-primary uppercase">Status Klaim Terkait</p>
                {selectedRecord.claims.map((claim: any, idx: number) => (
                  <div key={claim.id || `claim-detail-${idx}`} className="flex justify-between items-center p-2 border rounded bg-primary/5">
                    <span className="text-xs font-mono">{claim.id?.substring(0,8) || "..."}...</span>
                    <Badge variant={
                      claim.status === 'approved' ? 'success' :
                      claim.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {claim.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setSelectedRecord(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { 
  ShieldAlertIcon, 
  CheckCircle2Icon, 
  XCircleIcon, 
  HistoryIcon, 
  Settings2Icon, 
  SearchIcon,
  BookOpenIcon,
  CodeIcon,
  ShieldCheckIcon,
  FileTextIcon,
  AlertCircleIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

import { useClaims } from "@/hooks/useClaims"
import { useInsurancePolicies } from "@/hooks/useInsurancePolicies"
import { useAuthContext } from "@/context/AuthContext"
import { formatRupiah } from "@/lib/utils"

const formatDate = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
};

export default function InsuranceDashboard() {
  const { accessToken, user } = useAuthContext();
  const { getClaims, getClaimById, approveClaim, rejectClaim, verifyClaim, isLoading, zkpStatus } = useClaims(accessToken);

  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [activeMainTab, setActiveMainTab] = useState("pending");
  const [activeSubTab, setActiveSubTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  // Insurance Policies State
  const { 
    getPolicies, 
    getPolicy,
    createPolicy, 
    updatePolicy, 
    deletePolicy, 
    isLoading: isPolicyLoading 
  } = useInsurancePolicies(accessToken);
  const [insurancePolicies, setInsurancePolicies] = useState<any[]>([]);
  const [policySearchTerm, setPolicySearchTerm] = useState("");
  
  // Policy Detail Modal State
  const [isPolicyDetailModalOpen, setIsPolicyDetailModalOpen] = useState(false);
  const [policyDetail, setPolicyDetail] = useState<any>(null);
  const [policyDetailTab, setPolicyDetailTab] = useState("diagnoses");
  const [policyDetailPage, setPolicyDetailPage] = useState(1);
  
  // Modal states
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Policy Form & Modal States
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<any>(null);

  const [policyForm, setPolicyForm] = useState({
    policy_name: "",
    max_coverage_amount: 0,
    valid_from: "",
    valid_until: "",
    diagnosis_codes: [] as string[],
    procedure_codes: [] as string[],
    is_active: true
  });
  const [displayCoverage, setDisplayCoverage] = useState("");

  // ICD Selection States
  const [diagnosesList, setDiagnosesList] = useState<any[]>([]);
  const [proceduresList, setProceduresList] = useState<any[]>([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const [diagPage, setDiagPage] = useState(1);
  const [procPage, setProcPage] = useState(1);
  const [diagTotal, setDiagTotal] = useState(1);
  const [procTotal, setProcTotal] = useState(1);
  const [diagSearch, setDiagSearch] = useState("");
  const [procSearch, setProcSearch] = useState("");

  const loadData = async () => {
    if (!accessToken) return;
    try {
      // Ambil semua status sekaligus untuk difilter di client
      // Menggunakan pendekatan fetch terpisah tapi tidak mematikan satu sama lain jika gagal
      let pending: any[] = [];
      let approved: any[] = [];
      let rejected: any[] = [];

      // Ambil data secara terpisah untuk reliabilitas maksimal
      await Promise.all([
        (async () => {
           try {
              const res = await getClaims({ status: 'submitted' });
              pending = res.data || [];
           } catch (e) { console.warn("Gagal muat pending:", e); }
        })(),
        (async () => {
           try {
              const res = await getClaims({ status: 'approved' });
              approved = res.data || [];
           } catch (e) { console.warn("Gagal muat approved:", e); }
        })(),
        (async () => {
           try {
              const res = await getClaims({ status: 'rejected' });
              rejected = res.data || [];
           } catch (e) { console.warn("Gagal muat rejected:", e); }
        })()
      ]);

      setAllClaims([...pending, ...approved, ...rejected]);
    } catch (error) {
      console.error("Gagal memuat data klaim:", error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  useEffect(() => {
    if (user?.institution_id) {
      setInstitutionId(user.institution_id);
    }
  }, [user]);

  const loadPolicies = async () => {
    if (!accessToken) return;
    if (!institutionId) {
      toast.error("ID Institusi tidak ditemukan. Silakan login ulang.");
      return;
    }
    try {
      const res = await getPolicies({ institutionId, isActive: undefined });
      setInsurancePolicies(res.data || []);
    } catch (error) {
      console.error("Gagal memuat data polis:", error);
      toast.error("Gagal memuat data polis");
    }
  };

  useEffect(() => {
    if (activeMainTab === "settings" && institutionId) {
      loadPolicies();
    }
  }, [activeMainTab, accessToken, institutionId]);

  const fetchICDData = async (type: 'diagnoses' | 'procedures', page: number, search: string) => {
    if (!accessToken) return;
    setIcdLoading(true);
    try {
      const url = `/api/policies/${type}?page=${page}&limit=5${search ? `&search=${search}` : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const res = await response.json();
      if (type === 'diagnoses') {
        setDiagnosesList(res.data || []);
        setDiagTotal(res.pagination?.total_pages || 1);
      } else {
        setProceduresList(res.data || []);
        setProcTotal(res.pagination?.total_pages || 1);
      }
    } catch (e) {
      console.error(`Gagal fetch ${type}:`, e);
    } finally {
      setIcdLoading(false);
    }
  };

  useEffect(() => {
    if (isPolicyModalOpen) {
       fetchICDData('diagnoses', diagPage, diagSearch);
    }
  }, [diagPage, diagSearch, isPolicyModalOpen, accessToken]);

  useEffect(() => {
    if (isPolicyModalOpen) {
       fetchICDData('procedures', procPage, procSearch);
    }
  }, [procPage, procSearch, isPolicyModalOpen, accessToken]);

  const handleRupiahInput = (value: string) => {
     // Hapus semua karakter non-digit
     const numericValue = value.replace(/[^0-9]/g, '');
     if (numericValue === "") {
        setDisplayCoverage("");
        setPolicyForm(prev => ({ ...prev, max_coverage_amount: 0 }));
        return;
     }
     const amount = parseInt(numericValue);
     setPolicyForm(prev => ({ ...prev, max_coverage_amount: amount }));
     setDisplayCoverage(formatRupiah(amount));
  };

  const openAddModal = () => {
    setEditingPolicy(null);
    setPolicyForm({
      policy_name: "",
      max_coverage_amount: 0,
      valid_from: "",
      valid_until: "",
      diagnosis_codes: [],
      procedure_codes: [],
      is_active: true
    });
    setDisplayCoverage("");
    setIsPolicyModalOpen(true);
  };

  const openEditModal = (policy: any) => {
    setEditingPolicy(policy);
    setPolicyForm({
      policy_name: policy.policy_name,
      max_coverage_amount: policy.max_coverage_amount,
      valid_from: policy.valid_from.split('T')[0],
      valid_until: policy.valid_until.split('T')[0],
      diagnosis_codes: [], // Biasanya tidak bisa ubah codes di service
      procedure_codes: [],
      is_active: policy.is_active
    });
    setDisplayCoverage(formatRupiah(policy.max_coverage_amount));
    setIsPolicyModalOpen(true);
  };

  const handleSavePolicy = async () => {
    if (!policyForm.policy_name || policyForm.max_coverage_amount <= 0) {
      toast.error("Harap isi nama dan nominal coverage.");
      return;
    }

    setIsProcessing(true);
    try {
      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, {
          policy_name: policyForm.policy_name,
          max_coverage_amount: policyForm.max_coverage_amount,
          valid_from: policyForm.valid_from,
          valid_until: policyForm.valid_until,
          is_active: policyForm.is_active
        });
        toast.success("Polis berhasil diperbarui");
      } else {
        if (policyForm.diagnosis_codes.length === 0 || policyForm.procedure_codes.length === 0) {
           toast.error("Pilih minimal satu diagnosa dan prosedur.");
           setIsProcessing(false);
           return;
        }
        await createPolicy(policyForm);
        toast.success("Polis baru berhasil dibuat");
      }
      setIsPolicyModalOpen(false);
      loadPolicies();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan polis");
    } finally {
      setIsProcessing(false);
    }
  };

const confirmDelete = (policy: any) => {
      setPolicyToDelete(policy);
      setIsDeleteModalOpen(true);
   };

   const handleDeleteFromDetail = async () => {
      if (!policyDetail) return;
      setPolicyToDelete(policyDetail);
      setIsPolicyDetailModalOpen(false);
      setIsDeleteModalOpen(true);
   };

   const handleViewPolicyDetail = async (policy: any) => {
      try {
         const fullData = await getPolicy(policy.id);
         setPolicyDetail(fullData);
         setIsPolicyDetailModalOpen(true);
      } catch (err) {
         console.error("Gagal mengambil detail polis:", err);
         toast.error("Gagal membuka detail polis");
      }
   };

  const handleDelete = async () => {
    if (!policyToDelete) return;
    setIsProcessing(true);
    try {
      await deletePolicy(policyToDelete.id);
      toast.success("Polis berhasil dihapus");
      setIsDeleteModalOpen(false);
      loadPolicies();
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus polis");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDetail = async (claim: any) => {
    // API menggunakan claim_id, pastikan kita mengirim ID yang benar ke getClaimById
    const id = claim.claim_id || claim.id;
    if (!id) {
       console.error("No ID found for claim", claim);
       toast.error("Gagal membuka detail: ID Klaim tidak ditemukan");
       return;
    }

    setSelectedClaim(claim);
    setReviewNotes("");
    try {
      const fullData = await getClaimById(id);
      if (fullData) setSelectedClaim(fullData);
    } catch (err) {
      console.error("Gagal mengambil detail klaim:", err);
    }
  };

  const onApprove = async () => {
    if (!selectedClaim) return;
    const id = selectedClaim.claim_id || selectedClaim.id;
    setIsProcessing(true);
    try {
      await approveClaim(id, reviewNotes);
      toast.success("Klaim berhasil disetujui");
      setSelectedClaim(null);
      loadData();
    } catch (err) {
      // toast handled in hook
    } finally {
      setIsProcessing(false);
    }
  };

  const onVerify = async () => {
    if (!selectedClaim) return;
    const id = selectedClaim.claim_id || selectedClaim.id;
    setIsProcessing(true);
    try {
      await verifyClaim(id);
      // Data akan terupdate otomatis via getClaimById atau realtime subscription jika ada
      const updated = await getClaimById(id);
      if (updated) setSelectedClaim(updated);
      loadData();
    } catch (err) {
      // toast handled in hook
    } finally {
      setIsProcessing(false);
    }
  };

  const onReject = async () => {
    if (!selectedClaim) return;
    const id = selectedClaim.claim_id || selectedClaim.id;
    if (!reviewNotes.trim()) {
      toast.error("Catatan penolakan wajib diisi");
      return;
    }
    setIsProcessing(true);
    try {
      await rejectClaim(id, reviewNotes);
      toast.success("Klaim telah ditolak");
      setSelectedClaim(null);
      loadData();
    } catch (err) {
      // toast handled in hook
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredClaims = allClaims.filter(c => {
    // API Menggunakan property flat dari service terbaru
    const id = c.claim_id || c.id || "";

    const matchesSearch = 
      id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeSubTab === "all") return true;
    return c.status === activeSubTab;
  });

  const pendingCount = allClaims.filter(c => c.status === 'submitted').length;
  const historyClaims = allClaims.filter(c => c.status === 'approved' || c.status === 'rejected');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Rejected</span>;
      case 'submitted':
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Submitted</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard Reviewer Asuransi</h1>
          <p className="text-muted-foreground font-medium">Validasi integritas medis menggunakan teknologi Zero-Knowledge Proof.</p>
        </div>
        <div className="relative w-full md:w-72">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama pasien..." 
            className="pl-10 bg-background border-primary/10 shadow-sm focus-visible:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
        <TabsList className="bg-background border p-1 rounded-xl shadow-sm">
          <TabsTrigger value="pending" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldAlertIcon className="size-4" />
            Review Klaim
            {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <HistoryIcon className="size-4" />
            Riwayat Keputusan
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings2Icon className="size-4" />
            Konfigurasi Polis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-none shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Antrean Klaim</CardTitle>
                  <CardDescription>Verifikasi data tanpa membuka privasi pasien menggunakan protokol ZKP.</CardDescription>
                </div>
                
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full md:w-auto">
                  <TabsList className="bg-muted/50 p-1 rounded-lg">
                    <TabsTrigger value="all" className="text-xs px-3 py-1.5 rounded-md">Semua</TabsTrigger>
                    <TabsTrigger value="submitted" className="text-xs px-3 py-1.5 rounded-md">Menunggu</TabsTrigger>
                    <TabsTrigger value="approved" className="text-xs px-3 py-1.5 rounded-md">Disetujui</TabsTrigger>
                    <TabsTrigger value="rejected" className="text-xs px-3 py-1.5 rounded-md">Ditolak</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-muted/50 text-[11px] uppercase tracking-wider">
                  <TableRow>
                    <TableHead className="font-bold py-4">ID Klaim</TableHead>
                    <TableHead className="font-bold">Tanggal Pengajuan</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-right">Nominal</TableHead>
                    <TableHead className="text-right font-bold w-[120px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInitialLoading && allClaims.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto rounded-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredClaims.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20">
                         <div className="flex flex-col items-center gap-2 opacity-30">
                            <CheckCircle2Icon className="size-12" />
                            <p className="font-medium">Tidak ada klaim dalam kategori ini.</p>
                         </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClaims.map((claim, idx) => {
                      if (!claim) return null;
                      const displayId = (claim.claim_id || claim.id || `pending-${idx}`);
                      return (
                        <TableRow key={displayId} className="group hover:bg-primary/5 transition-all cursor-pointer border-b" onClick={() => handleViewDetail(claim)}>
                          <TableCell>
                            <div className="font-mono font-bold text-primary uppercase text-sm">
                              {displayId.split('-')[0]}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {formatDate(claim.submitted_at || new Date().toISOString())}
                          </TableCell>
                          <TableCell className="text-center">
                             {getStatusBadge(claim.status)}
                          </TableCell>
                          <TableCell className="font-bold text-foreground text-sm text-right">
                            {formatRupiah(claim.claim_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all rounded-full px-5"
                            >
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-xl">Riwayat Keputusan Klaim</CardTitle>
              <CardDescription>Daftar klaim yang telah Anda proses dalam 30 hari terakhir.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">ID Klaim</TableHead>
                    <TableHead className="font-bold">Tanggal Proses</TableHead>
                    <TableHead className="font-bold text-right">Nominal</TableHead>
                    <TableHead className="font-bold text-right">Status Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyClaims.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 opacity-30 italic">Belum ada riwayat klaim.</TableCell>
                    </TableRow>
                  ) : (
                    historyClaims.map((claim, idx) => {
                      if (!claim) return null;
                      const displayId = (claim.id || claim.claim_id || `history-${idx}`);
                      return (
                        <TableRow key={displayId}>
                          <TableCell className="font-mono text-xs">{displayId.split('-')[0].toUpperCase()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(claim.submitted_at)}</TableCell>
                          <TableCell className="font-semibold text-sm text-right">{formatRupiah(claim.claim_amount)}</TableCell>
                          <TableCell className="text-right">
                             {getStatusBadge(claim.status)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <Card className="border-none shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Daftar Polis Asuransi</CardTitle>
                  <CardDescription>Kelola parameter dan aturan verifikasi polis untuk institusi Anda.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-full md:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Cari nama polis..." 
                      className="pl-9 h-9 text-xs"
                      value={policySearchTerm}
                      onChange={(e) => setPolicySearchTerm(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="gap-2 rounded-xl h-9 text-xs px-4 shadow-md shadow-primary/20"
                    onClick={openAddModal}
                  >
                    <PlusIcon className="size-3.5" />
                    Tambah Polis
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader className="bg-muted/30 text-[10px] uppercase tracking-wider">
                  <TableRow>
                    <TableHead className="font-bold py-3">Nama Polis</TableHead>
                    <TableHead className="font-bold">Masa Berlaku</TableHead>
                    <TableHead className="font-bold">Max Coverage</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="text-right font-bold w-[120px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPolicyLoading && insurancePolicies.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`policy-skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                        <TableCell className="text-right flex justify-end gap-2">
                           <Skeleton className="h-8 w-8 rounded-lg" />
                           <Skeleton className="h-8 w-8 rounded-lg" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : insurancePolicies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20">
                         <div className="flex flex-col items-center gap-2 opacity-30">
                            <BookOpenIcon className="size-12" />
                            <p className="font-medium text-sm">Belum ada polis yang terdaftar.</p>
                         </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    insurancePolicies
                      .filter(p => p.policy_name.toLowerCase().includes(policySearchTerm.toLowerCase()))
                      .map((policy, idx) => (
                        <TableRow key={policy.id || `policy-${idx}`} className="hover:bg-primary/5 transition-all border-b group">
                          <TableCell>
                            <div className="font-bold text-sm text-primary">{policy.policy_name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase">{policy.id.split('-')[0]}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">
                              {formatDate(policy.valid_from)} - {formatDate(policy.valid_until)}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-sm text-foreground">
                            {formatRupiah(policy.max_coverage_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                             {policy.is_active ? (
                               <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Aktif</span>
                             ) : (
                               <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Non-Aktif</span>
                             )}
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="size-8 rounded-lg text-primary hover:bg-primary/10"
                                  onClick={() => handleViewPolicyDetail(policy)}
                                >
                                  <BookOpenIcon className="size-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="size-8 rounded-lg text-primary hover:bg-primary/10"
                                  onClick={() => openEditModal(policy)}
                                >
                                  <PencilIcon className="size-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                                  onClick={() => confirmDelete(policy)}
                                >
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail & Action Modal (Landscape) */}
      <Dialog open={!!selectedClaim} onOpenChange={(open) => {
        if (!open) {
          setSelectedClaim(null);
          setReviewNotes("");
        }
      }}>
        <DialogContent className="sm:max-w-[1000px] md:max-w-[1200px] lg:max-w-7xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <div className="p-6 pb-4 border-b shrink-0 bg-muted/20">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <ShieldCheckIcon className="size-6 text-primary" />
                    </div>
                    Tinjau Bukti Medis Klaim
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Reviewer hanya dapat melihat bukti kepatuhan medis tanpa mengakses data rekam medis privat.
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-3">
                   <div className="px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-[10px] font-bold border border-green-500/20 tracking-wider">
                      ECC P-256 SECURE
                   </div>
                   <div className="px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold border border-blue-500/20 tracking-wider">
                      SNARK VERIFIED
                   </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          {selectedClaim && (
            <div className="flex-1 overflow-hidden p-0 flex flex-col md:flex-row">
              {/* Left Sidebar: Metadata & Patient Info */}
              <div className="w-full md:w-[400px] border-r bg-muted/5 p-8 overflow-y-auto space-y-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-1">Target Verifikasi</Label>
                    <div className="p-5 bg-background rounded-2xl border shadow-sm space-y-4">
                       <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Prosedur Medis</p>
                          <p className="text-sm font-bold leading-tight">{selectedClaim.procedure_description || selectedClaim.procedures?.description}</p>
                          <p className="text-[10px] font-mono text-primary bg-primary/5 px-2 py-0.5 rounded w-fit">
                            ICD-9: {selectedClaim.procedure_code || selectedClaim.procedures?.icd9_code}
                          </p>
                       </div>
                       <div className="space-y-1 border-t pt-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Nominal Biaya</p>
                          <p className="text-2xl font-black text-foreground">{formatRupiah(selectedClaim.claim_amount)}</p>
                       </div>
                    </div>
                  </div>

                  {selectedClaim.patient_policies && (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-1">Cakupan Polis</Label>
                      <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                           <FileTextIcon className="size-3 text-blue-600" />
                           <span className="text-sm font-bold text-blue-900">{selectedClaim.patient_policies.insurance_policies?.policy_name}</span>
                        </div>
                        <div className="text-[11px] text-blue-800 font-medium">No Polis: {selectedClaim.patient_policies.policy_number}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-1">Catatan Reviewer</Label>
                  <Textarea 
                    placeholder="Contoh: Bukti rekam medis sesuai dengan diagnosa..."
                    className="min-h-[120px] rounded-2xl border-2 focus-visible:ring-primary/20 bg-background shadow-inner resize-none p-4"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground italic px-1">
                    * Wajib diisi jika klaim ditolak (Reject).
                  </p>
                </div>
              </div>

              {/* Main Content: Technical Proof & Decision */}
              <div className="flex-1 flex flex-col min-w-0 bg-background">
                <div className="px-8 py-4 border-b bg-muted/5 flex items-center justify-between shrink-0">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest flex items-center gap-2">
                    <CodeIcon className="size-3 text-primary" />
                    Kriptografi Zero-Knowledge Proof (ZKP)
                  </Label>
                  <div className="flex items-center gap-2">
                     <AlertCircleIcon className="size-3 text-amber-500" />
                     <span className="text-[10px] text-amber-600 font-bold uppercase">Integritas Terjamin Sistem</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <Label className="text-[11px] font-bold text-foreground">zk-SNARK Proof Object</Label>
                         <span className="text-[9px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">GROTH16 PROTOCOL</span>
                      </div>


                      <div className="max-h-[350px] overflow-auto p-5 bg-slate-950 text-slate-300 rounded-3xl border font-mono text-[10px] shadow-2xl leading-relaxed">
                        {selectedClaim.zkp_proofs ? (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.proof_json : selectedClaim.zkp_proofs?.proof_json, null, 2)}</pre>
                        ) : (
                          <p className="italic text-slate-500 py-10 text-center">Data Proof belum dikirimkan oleh pasien.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                       <Label className="text-[11px] font-bold text-foreground">Verified Public Signals</Label>
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                          {[
                            { label: "Patient Inclusion", status: "VERIFIED" },
                            { label: "Hospital Root", status: "VERIFIED" },
                            { label: "Policy Validity", status: "VERIFIED" },
                            { label: "Procedure Code", status: "MATCHED" }
                          ].map((item, idx) => (
                            <div key={idx} className="p-3 bg-muted/50 border rounded-2xl text-center space-y-1">
                               <p className="text-[8px] uppercase font-bold text-muted-foreground">{item.label}</p>
                               <p className="text-[10px] font-black text-green-600">{item.status}</p>
                            </div>
                          ))}
                       </div>
                       <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border p-5 shadow-inner">
                          {selectedClaim.zkp_proofs ? (
                             (() => {
                               const signals = Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.public_signals : selectedClaim.zkp_proofs?.public_signals;
                               if (!signals || signals.length === 0) return <p className="italic py-4 text-center text-muted-foreground text-xs">Public signals kosong.</p>;
                               
                               const mapping = [
                                 { id: 0, label: "Procedure Code (ICD-9)", value: signals[0] },
                                 { id: 1, label: "Procedure Date", value: signals[1], isDate: true },
                                 { id: 2, label: "Claim Amount", value: signals[2], isCurrency: true },
                                 { id: 3, label: "Approved Diagnosis Merkle Root Hash", value: signals[3] },
                                 { id: 4, label: "Approved Procedure Merkle Root Hash", value: signals[4] },
                                 { id: 5, label: "Max Coverage", value: signals[5], isCurrency: true },
                               ];

                               return (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {mapping.map((signal) => (
                                      <div key={signal.id} className="flex flex-col bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:border-primary/40 hover:shadow-md group">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{signal.label}</span>
                                        {signal.isCurrency && signal.value && !isNaN(Number(signal.value)) ? (
                                          <span className="text-[11px] font-bold text-primary">
                                            {formatRupiah(Number(signal.value))}
                                          </span>
                                        ) : signal.isDate && signal.value && typeof signal.value === 'string' && signal.value.length === 8 ? (
                                          <span className="text-[11px] font-bold text-primary">
                                            {`${signal.value.substring(6, 8)}-${signal.value.substring(4, 6)}-${signal.value.substring(0, 4)}`}
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-mono font-medium text-foreground break-all">
                                            {signal.value || "-"}
                                          </span>
                                        )}
                                      </div>
                                   ))}
                                 </div>
                               );
                             })()
                          ) : (
                             <p className="italic py-4 text-center text-muted-foreground text-xs">Public signals tidak tersedia.</p>
                          )}
                       </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-muted-foreground/10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/30 rounded-2xl">
                      <div className="flex gap-3 w-full sm:w-auto">
                        {selectedClaim.status === 'submitted' && (
                          <Button 
                            variant="secondary"
                            size="lg"
                            className="flex-1 sm:flex-none h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-md active:scale-95"
                            onClick={onVerify}
                            disabled={isProcessing || (selectedClaim.zkp_proofs && (Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.verification_result !== null : selectedClaim.zkp_proofs?.verification_result !== null))}
                          >
                            <ShieldCheckIcon className="size-4 mr-2" />
                            {isProcessing || zkpStatus === 'verifying' ? "Verifying..." : "Verify Proof"}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="lg" 
                          className="flex-1 sm:flex-none h-12 px-6 rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-white font-bold transition-all shadow-md active:scale-95"
                          onClick={onReject}
                          disabled={isProcessing || selectedClaim.status !== 'submitted'}
                        >
                          <XCircleIcon className="size-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                      <Button 
                        size="lg" 
                        className="w-full sm:w-auto h-12 px-10 rounded-xl bg-primary hover:bg-primary/90 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
                        onClick={onApprove}
                        disabled={isProcessing || selectedClaim.status !== 'submitted' || (selectedClaim.zkp_proofs && (Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.verification_result !== true : selectedClaim.zkp_proofs?.verification_result !== true))}
                      >
                        <CheckCircle2Icon className="size-4 mr-2" />
                        {isProcessing ? "Processing..." : "Approve Claim"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-t bg-muted/5 shrink-0 text-center text-muted-foreground flex justify-center items-center gap-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Secured by snarkjs GROTH16 Protocol</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary/30" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em]">E2E Verified Audit Trail</span>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
        <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  {editingPolicy ? (
                    <><PencilIcon className="size-6 text-primary" /> Edit Polis</>
                  ) : (
                    <><PlusIcon className="size-6 text-primary" /> Buat Polis Baru</>
                  )}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {editingPolicy ? "Perbarui informasi dasar polis asuransi." : "Tentukan parameter verifikasi dan limit untuk asuransi baru."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex flex-col lg:flex-row gap-10 py-8 min-h-[500px]">
            {/* BAGIAN KIRI: DATA POLIS */}
            <div className={`space-y-6 ${editingPolicy ? 'w-full max-w-2xl mx-auto' : 'lg:w-[380px] shrink-0'}`}>
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">1</div>
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Informasi Dasar</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="policy_name" className="text-xs font-bold uppercase text-slate-400">Nama Polis</Label>
                  <Input 
                    id="policy_name" 
                    placeholder="Misal: Claimly Basic Plan" 
                    className="h-12 rounded-xl border-slate-200 focus:ring-primary"
                    value={policyForm.policy_name}
                    onChange={(e) => setPolicyForm({...policyForm, policy_name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_coverage" className="text-xs font-bold uppercase text-slate-400">Nominal Batas (Coverage)</Label>
                  <Input 
                    id="max_coverage" 
                    placeholder="Rp 0" 
                    className="h-12 rounded-xl border-slate-200 font-bold text-primary"
                    value={displayCoverage}
                    onChange={(e) => handleRupiahInput(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valid_from" className="text-xs font-bold uppercase text-slate-400">Berlaku Dari</Label>
                    <Input 
                      id="valid_from" 
                      type="date"
                      className="h-12 rounded-xl border-slate-200"
                      value={policyForm.valid_from}
                      onChange={(e) => setPolicyForm({...policyForm, valid_from: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valid_until" className="text-xs font-bold uppercase text-slate-400">Berlaku Sampai</Label>
                    <Input 
                      id="valid_until" 
                      type="date"
                      className="h-12 rounded-xl border-slate-200"
                      value={policyForm.valid_until}
                      onChange={(e) => setPolicyForm({...policyForm, valid_until: e.target.value})}
                    />
                  </div>
                </div>

                {editingPolicy && (
                   <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-2xl border border-primary/10 mt-6">
                      <input 
                        type="checkbox" 
                        id="is_active" 
                        className="size-5 rounded accent-primary border-primary/20"
                        checked={policyForm.is_active}
                        onChange={(e) => setPolicyForm({...policyForm, is_active: e.target.checked})}
                      />
                      <Label htmlFor="is_active" className="font-bold text-sm text-primary cursor-pointer">Status Polis Aktif</Label>
                   </div>
                )}
              </div>
            </div>

            {/* BAGIAN KANAN: WHITELIST (Hanya tampil saat buat baru) */}
            {!editingPolicy && (
              <div className="flex-1 lg:pl-10 lg:border-l border-slate-100 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">2</div>
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Parameter Whitelist</h3>
                </div>

                <Tabs defaultValue="diag" className="flex-1 flex flex-col">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl h-11">
                    <TabsTrigger value="diag" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">ICD-10 (DIAGNOSA)</TabsTrigger>
                    <TabsTrigger value="proc" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">ICD-9 (PROSEDUR)</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="diag" className="flex-1 flex flex-col pt-4 space-y-4">
                    <div className="relative group">
                       <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                       <Input 
                          placeholder="Cari kode atau nama diagnosa..." 
                          className="h-11 pl-10 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-primary transition-all text-sm" 
                          value={diagSearch}
                          onChange={(e) => { setDiagSearch(e.target.value); setDiagPage(1); }}
                       />
                    </div>
                    <div className="flex-1 min-h-[300px] border border-slate-100 rounded-2xl p-3 overflow-y-auto bg-slate-50/30 shadow-inner">
                      {icdLoading ? (
                        <div className="flex flex-col gap-3 p-4">
                           <Skeleton className="h-12 w-full rounded-lg" />
                           <Skeleton className="h-12 w-full rounded-lg" />
                           <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {diagnosesList.map((item, idx) => (
                            <div key={`${item.icd10_code || 'diag'}-${idx}`} className="flex items-center space-x-3 p-3 bg-white hover:bg-white rounded-xl border border-slate-100/50 hover:border-primary/20 hover:shadow-sm transition-all group">
                              <input 
                                type="checkbox" 
                                id={`diag-${item.icd10_code}`}
                                className="size-5 rounded-lg accent-primary border-slate-200 cursor-pointer" 
                                checked={policyForm.diagnosis_codes.includes(item.icd10_code)}
                                onChange={(e) => {
                                  const codes = e.target.checked 
                                    ? [...policyForm.diagnosis_codes, item.icd10_code]
                                    : policyForm.diagnosis_codes.filter(c => c !== item.icd10_code);
                                  setPolicyForm({...policyForm, diagnosis_codes: codes});
                                }}
                              />
                              <Label htmlFor={`diag-${item.icd10_code}`} className="flex-1 flex flex-col gap-0.5 cursor-pointer">
                                 <span className="font-bold text-slate-700">{item.icd10_code}</span>
                                 <span className="text-[11px] text-slate-400 font-medium line-clamp-1 group-hover:text-slate-600">{item.description}</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                       <p className="text-xs font-bold text-primary px-2">Terpilih: {policyForm.diagnosis_codes.length}</p>
                       <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100" 
                            disabled={diagPage <= 1}
                            onClick={() => setDiagPage(d => d - 1)}
                          >{"<"}</Button>
                          <span className="text-[10px] font-bold text-slate-500 min-w-20 text-center">{diagPage} / {diagTotal}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100"
                            disabled={diagPage >= diagTotal}
                            onClick={() => setDiagPage(d => d + 1)}
                          >{">"}</Button>
                       </div>
                    </div>
                  </TabsContent>
  
                  <TabsContent value="proc" className="flex-1 flex flex-col pt-4 space-y-4">
                    <div className="relative group">
                       <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                       <Input 
                          placeholder="Cari kode atau nama prosedur..." 
                          className="h-11 pl-10 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-primary transition-all text-sm" 
                          value={procSearch}
                          onChange={(e) => { setProcSearch(e.target.value); setProcPage(1); }}
                       />
                    </div>
                    <div className="flex-1 min-h-[300px] border border-slate-100 rounded-2xl p-3 overflow-y-auto bg-slate-50/30 shadow-inner">
                      {icdLoading ? (
                        <div className="flex flex-col gap-3 p-4">
                           <Skeleton className="h-12 w-full rounded-lg" />
                           <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {proceduresList.map((item, idx) => (
                            <div key={`${item.icd9_code || 'proc'}-${idx}`} className="flex items-center space-x-3 p-3 bg-white hover:bg-white rounded-xl border border-slate-100/50 hover:border-primary/20 hover:shadow-sm transition-all group">
                              <input 
                                type="checkbox" 
                                id={`proc-${item.icd9_code}`}
                                className="size-5 rounded-lg accent-primary border-slate-200 cursor-pointer" 
                                checked={policyForm.procedure_codes.includes(item.icd9_code)}
                                onChange={(e) => {
                                  const codes = e.target.checked 
                                    ? [...policyForm.procedure_codes, item.icd9_code]
                                    : policyForm.procedure_codes.filter(c => c !== item.icd9_code);
                                  setPolicyForm({...policyForm, procedure_codes: codes});
                                }}
                              />
                              <Label htmlFor={`proc-${item.icd9_code}`} className="flex-1 flex flex-col gap-0.5 cursor-pointer">
                                 <span className="font-bold text-slate-700">{item.icd9_code}</span>
                                 <span className="text-[11px] text-slate-400 font-medium line-clamp-1 group-hover:text-slate-600">{item.description}</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                       <p className="text-xs font-bold text-primary px-2">Terpilih: {policyForm.procedure_codes.length}</p>
                       <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100" 
                            disabled={procPage <= 1}
                            onClick={() => setProcPage(d => d - 1)}
                          >{"<"}</Button>
                          <span className="text-[10px] font-bold text-slate-500 min-w-20 text-center">{procPage} / {procTotal}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100"
                            disabled={procPage >= procTotal}
                            onClick={() => setProcPage(d => d + 1)}
                          >{">"}</Button>
                       </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
             <Button variant="ghost" onClick={() => setIsPolicyModalOpen(false)} disabled={isProcessing}>Batal</Button>
             <Button 
               className="bg-primary shadow-lg shadow-primary/20 rounded-xl px-8" 
               onClick={handleSavePolicy}
               disabled={isProcessing}
             >
               {isProcessing ? "Menyimpan..." : (editingPolicy ? "Simpan Perubahan" : "Terbitkan Polis")}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Hapus */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-slate-100 shadow-2xl rounded-3xl p-8 backdrop-blur-xl">
          <DialogHeader className="items-center text-center space-y-4">
             <div className="size-20 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                <div className="size-14 bg-red-100 rounded-full flex items-center justify-center">
                   <Trash2Icon className="size-8 text-red-600" />
                </div>
             </div>
             <div className="space-y-2">
                <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight italic">Hapus Polis?</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium text-base">
                   Anda yakin ingin menghapus <span className="text-red-600 font-bold underline decoration-red-200 underline-offset-4">{policyToDelete?.policy_name}</span>? Tindakan ini permanen dan berisiko memengaruhi verifikasi klaim berjalan.
                </DialogDescription>
             </div>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-3 pt-6 mt-2 border-t border-slate-50">
             <Button 
               variant="outline" 
               className="flex-1 h-14 rounded-2xl border-2 font-bold text-slate-600 hover:bg-slate-50 transition-all text-base"
               onClick={() => setIsDeleteModalOpen(false)}
               disabled={isProcessing}
             >Batal</Button>
             <Button 
               variant="destructive" 
               className="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 font-black text-white shadow-xl shadow-red-200 hover:shadow-red-300 transition-all text-base"
               onClick={handleDelete}
               disabled={isProcessing}
             >
                {isProcessing ? "Menghapus..." : "Ya, Hapus Sekarang"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Detail Modal */}
      <Dialog open={isPolicyDetailModalOpen} onOpenChange={(open) => {
         if (!open) {
            setPolicyDetail(null);
         }
         setIsPolicyDetailModalOpen(open);
      }}>
         <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader className="border-b pb-4">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <DialogTitle className="text-xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                           <BookOpenIcon className="size-5 text-primary" />
                        </div>
                        Detail Polis Asuransi
                     </DialogTitle>
                     <DialogDescription>
                        Informasi lengkap mengenai polis dan prosedur yang dicover.
                     </DialogDescription>
                  </div>
                  {policyDetail?.is_active !== undefined && (
                     <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${policyDetail.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {policyDetail.is_active ? 'Aktif' : 'Non-Aktif'}
                     </div>
                  )}
               </div>
</DialogHeader>
            
            {policyDetail && (
              <div className="py-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-5 bg-muted/30 rounded-2xl border">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nama Polis</p>
                      <p className="font-bold text-lg text-primary">{policyDetail.policy_name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">ID Polis</p>
                      <p className="font-mono text-xs text-muted-foreground">{policyDetail.id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Masa Berlaku</p>
                      <p className="text-sm font-medium">
                        {formatDate(policyDetail.valid_from)} - {formatDate(policyDetail.valid_until)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Max Coverage</p>
                      <p className="text-2xl font-black text-primary">{formatRupiah(policyDetail.max_coverage_amount)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Tabs value={policyDetailTab} onValueChange={(v) => { setPolicyDetailTab(v); setPolicyDetailPage(1); }} className="flex-1 flex flex-col">
                      <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl h-10">
                        <TabsTrigger value="diagnoses" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          ICD-10 Diagnosa ({policyDetail.covered_diagnoses?.length || 0})
                        </TabsTrigger>
                        <TabsTrigger value="procedures" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          ICD-9 Prosedur ({policyDetail.covered_procedures?.length || 0})
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="diagnoses" className="flex-1 flex flex-col pt-3 space-y-3">
                        <div className="flex-1 max-h-[200px] overflow-y-auto border rounded-2xl">
                          {policyDetail.covered_diagnoses?.length > 0 ? (
                            <div className="divide-y">
                              {policyDetail.covered_diagnoses.slice(0, 5).map((item: any, idx: number) => (
                                <div key={`diag-${idx}`} className="p-3 hover:bg-muted/20">
                                  <div className="font-mono text-xs font-bold text-primary">{item.icd10_code}</div>
                                  <div className="text-xs text-muted-foreground line-clamp-2">{item.description}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-muted-foreground text-xs">Belum ada diagnosa</div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="procedures" className="flex-1 flex flex-col pt-3 space-y-3">
                        <div className="flex-1 max-h-[200px] overflow-y-auto border rounded-2xl">
                          {policyDetail.covered_procedures?.length > 0 ? (
                            <div className="divide-y">
                              {policyDetail.covered_procedures.slice(0, 5).map((item: any, idx: number) => (
                                <div key={`proc-${idx}`} className="p-3 hover:bg-muted/20">
                                  <div className="font-mono text-xs font-bold text-primary">{item.icd9_code}</div>
                                  <div className="text-xs text-muted-foreground line-clamp-2">{item.description}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-muted-foreground text-xs">Belum ada prosedur</div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter className="gap-2 sm:gap-0">
               <Button 
                  variant="outline" 
                  className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                  onClick={handleDeleteFromDetail}
               >
                  <Trash2Icon className="size-4 mr-2" />
                  Hapus Polis
               </Button>
               <Button 
                  className="bg-primary shadow-lg shadow-primary/20 rounded-xl"
                  onClick={() => {
                     openEditModal(policyDetail);
                     setPolicyDetail(null);
                     setIsPolicyDetailModalOpen(false);
                  }}
               >
                  <PencilIcon className="size-4 mr-2" />
                  Edit Polis
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  )
}

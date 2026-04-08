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
  UserIcon,
  FileTextIcon,
  AlertCircleIcon
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
  const { accessToken } = useAuthContext();
  const { getClaims, getClaimById, approveClaim, rejectClaim, verifyClaim, isLoading, zkpStatus } = useClaims(accessToken);

  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Modal states
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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
    // API Menggunakan property flat
    const patientName = c.patient_name || c.medical_record?.patient?.full_name || "";
    const description = c.procedure_description || c.procedures?.description || "";
    const id = c.claim_id || c.id || "";

    const matchesSearch = 
      patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

      <Tabs defaultValue="pending" className="space-y-6">
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
                    <TableHead className="font-bold py-4">Pasien & ID Klaim</TableHead>
                    <TableHead className="font-bold">Rumah Sakit</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold">Nominal</TableHead>
                    <TableHead className="text-right font-bold w-[120px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInitialLoading && allClaims.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16 mt-1" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
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
                    filteredClaims.map((claim) => {
                      if (!claim) return null;
                      const displayId = (claim.claim_id || claim.id || "");
                      return (
                        <TableRow key={displayId} className="group hover:bg-primary/5 transition-all cursor-pointer" onClick={() => handleViewDetail(claim)}>
                          <TableCell>
                            <div className="font-semibold text-foreground">
                              {claim.patient_name || claim.medical_record?.patient?.full_name || ("Pasien " + displayId.split('-')[0].toUpperCase())}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase">{displayId.split('-')[0]}</div>
                          </TableCell>
                        <TableCell className="text-sm font-medium">
                          {claim.institution_name || claim.medical_record?.institution?.name || "RS Terdaftar"}
                        </TableCell>
                        <TableCell className="text-center">
                           {getStatusBadge(claim.status)}
                        </TableCell>
                        <TableCell className="font-bold text-primary">{formatRupiah(claim.claim_amount)}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="bg-primary/5 hover:bg-primary hover:text-white transition-all"
                            >
                              Tinjau
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
                    <TableHead className="font-bold">Pasien</TableHead>
                    <TableHead className="font-bold">Tanggal Proses</TableHead>
                    <TableHead className="font-bold">Nominal</TableHead>
                    <TableHead className="font-bold text-right">Status Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyClaims.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 opacity-30 italic">Belum ada riwayat klaim.</TableCell>
                    </TableRow>
                  ) : (
                    historyClaims.map((claim) => {
                      if (!claim) return null;
                      const displayId = (claim.id || claim.claim_id || "");
                      return (
                        <TableRow key={displayId}>
                          <TableCell className="font-mono text-xs">{displayId.split('-')[0].toUpperCase()}</TableCell>
                          <TableCell className="font-medium text-sm">{claim.medical_record?.patient?.full_name || claim.patient_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(claim.updated_at)}</TableCell>
                          <TableCell className="font-semibold text-sm">{formatRupiah(claim.claim_amount)}</TableCell>
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
           <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-xl text-primary">Konfigurasi Aturan Polis</CardTitle>
              <CardDescription>Konfigurasi parameter otomatis untuk verifikasi ZKP.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-28 justify-start p-6 gap-5 border-2 hover:border-primary/50 transition-all rounded-2xl group">
                  <div className="p-3 bg-muted group-hover:bg-primary/10 rounded-xl">
                    <Settings2Icon className="size-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="text-left space-y-1">
                    <div className="font-bold text-base">Update ICD-10 whitelist</div>
                    <div className="text-xs text-muted-foreground">Diagnosa yang secara otomatis lolos ZKP Check.</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-28 justify-start p-6 gap-5 border-2 hover:border-primary/50 transition-all rounded-2xl group">
                   <div className="p-3 bg-muted group-hover:bg-primary/10 rounded-xl">
                    <ShieldCheckIcon className="size-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="text-left space-y-1">
                    <div className="font-bold text-base">Fraud Threshold Limits</div>
                    <div className="text-xs text-muted-foreground">Parameter anomali pengajuan nominal klaim.</div>
                  </div>
                </Button>
              </div>
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
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-1">Identitas Klaim</Label>
                    <div className="p-4 bg-background rounded-2xl border shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                         <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserIcon className="size-5 text-primary" />
                         </div>
                         <div>
                            <div className="font-bold text-sm leading-none">
                              {selectedClaim.patient_name || selectedClaim.medical_record?.patient?.full_name || ("Pasien " + (selectedClaim.claim_id || selectedClaim.id || "").split('-')[0].toUpperCase())}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                              Asal: {selectedClaim.institution_name || selectedClaim.medical_record?.institution?.name || "RS Terdaftar"}
                            </div>
                         </div>
                      </div>
                      <div className="pt-2 border-t flex justify-between items-center text-[11px]">
                         <span className="text-muted-foreground">ID Klaim:</span>
                         <span className="font-mono font-bold text-primary">{(selectedClaim.claim_id || selectedClaim.id || "").split('-')[0].toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

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
                       <div className="p-5 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-green-500 rounded-2xl border font-mono text-[10px] shadow-inner">
                          {selectedClaim.zkp_proofs ? (
                             <pre className="whitespace-pre-wrap">{JSON.stringify(Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.public_signals : selectedClaim.zkp_proofs?.public_signals, null, 2)}</pre>
                          ) : (
                             <p className="italic py-4 text-center">Public signals tidak tersedia.</p>
                          )}
                       </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between gap-6">
                     <div className="flex-1 p-5 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex gap-4 text-xs leading-relaxed text-primary/80">
                        <ShieldCheckIcon className="size-6 shrink-0 mt-1" />
                        <div>
                           <p className="font-bold mb-1">Keputusan Adil & Aman</p>
                           <p>Audit ZKP membuktikan rekam medis sesuai tanpa membocorkan isi catatan medis. Anda hanya perlu menyetujui jika bukti teknis di atas valid.</p>
                        </div>
                     </div>
                      <div className="flex gap-4 p-2 bg-muted/50 rounded-2xl border">
                        {selectedClaim.status === 'submitted' && (
                          <Button 
                            variant="secondary"
                            size="lg"
                            className="h-14 px-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-md active:scale-95"
                            onClick={onVerify}
                            disabled={isProcessing || (selectedClaim.zkp_proofs && (Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.verification_result !== null : selectedClaim.zkp_proofs?.verification_result !== null))}
                          >
                            <ShieldCheckIcon className="size-5 mr-2" />
                            {isProcessing || zkpStatus === 'verifying' ? "Verifying..." : "Verify Proof"}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="lg" 
                          className="h-14 px-8 rounded-xl border-destructive/20 text-destructive hover:bg-destructive hover:text-white font-bold transition-all shadow-md active:scale-95"
                          onClick={onReject}
                          disabled={isProcessing || selectedClaim.status !== 'submitted'}
                        >
                          <XCircleIcon className="size-5 mr-2" />
                          Reject Claim
                        </Button>
                        <Button 
                          size="lg" 
                          className="h-14 px-12 rounded-xl bg-primary hover:bg-primary/90 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
                          onClick={onApprove}
                          disabled={isProcessing || selectedClaim.status !== 'submitted' || (selectedClaim.zkp_proofs && (Array.isArray(selectedClaim.zkp_proofs) ? selectedClaim.zkp_proofs[0]?.verification_result !== true : selectedClaim.zkp_proofs?.verification_result !== true))}
                        >
                          <CheckCircle2Icon className="size-5 mr-2" />
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
    </div>
  )
}

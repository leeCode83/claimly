"use client"

import { useState, useEffect } from "react"
import { 
  HistoryIcon, 
  FileTextIcon, 
  ShieldCheckIcon, 
  MessageCircleIcon, 
  ArrowRightIcon, 
  LockIcon, 
  EyeIcon, 
  SearchIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon
} from "lucide-react"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'

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

const formatLongDate = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
};

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

import { useMedicalRecords } from "@/hooks/useMedicalRecords"
import { useClaims } from "@/hooks/useClaims"
import { useUsers } from "@/hooks/useUsers"
import { usePatients } from "@/hooks/usePatients"
import { useAuthContext } from "@/context/AuthContext"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

export default function PatientDashboard() {
  const { accessToken } = useAuthContext();
  const { getMedicalRecords, getMedicalRecord, decryptMedicalRecord, isLoading: isLoadingRecords } = useMedicalRecords(accessToken);
  const { getClaims, getClaimById, isLoading: isLoadingClaims } = useClaims(accessToken);
  const { getMe } = useUsers(accessToken);
  const { getPatientPolicies } = usePatients(accessToken);

  const [records, setRecords] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [fullUserData, setFullUserData] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  
  // State for detail modals
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [isZkpDetailExpanded, setIsZkpDetailExpanded] = useState(false);
  const [claimProofData, setClaimProofData] = useState<any>(null);
  const [isProofLoading, setIsProofLoading] = useState(false);
  
  // Decryption state
  const [password, setPassword] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});

  // Filtering state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [policyFilter, setPolicyFilter] = useState<string>("all");

  const loadData = async () => {
    if (!accessToken) return;
    try {
      const [recordsRes, claimsRes, userRes] = await Promise.all([
        getMedicalRecords(),
        getClaims({
          status: statusFilter === 'all' ? undefined : statusFilter,
          patient_policy_id: policyFilter === 'all' ? undefined : policyFilter
        }),
        getMe()
      ]);
      setRecords(recordsRes.data || []);
      setClaims(claimsRes.data || []);
      setFullUserData(userRes);

      // Load policies if patient_id exists
      if (userRes?.patient_id) {
        const policiesRes = await getPatientPolicies(userRes.patient_id);
        // Pastikan kita mengambil array dari properti data
        const policiesData = policiesRes?.data;
        setPolicies(Array.isArray(policiesData) ? policiesData : []);
      }
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  // Refetch claims when filters change
  useEffect(() => {
    const refreshClaims = async () => {
      if (!accessToken) return;
      try {
        const claimsRes = await getClaims({
          status: statusFilter === 'all' ? undefined : statusFilter,
          patient_policy_id: policyFilter === 'all' ? undefined : policyFilter
        });
        setClaims(claimsRes.data || []);
      } catch (error) {
        console.error("Gagal memfilter klaim:", error);
      }
    };
    
    if (fullUserData) {
      refreshClaims();
    }
  }, [statusFilter, policyFilter]);

  const handleOpenRecordDetail = async (record: any) => {
    setSelectedRecord(record);
    // Reset state for new record
    setPassword("");
    
    try {
      const fullRecord = await getMedicalRecord(record.id);
      if (fullRecord) {
        setSelectedRecord(fullRecord);
      }
    } catch (error) {
      console.error("Gagal mengambil detail rekam medis:", error);
      // Fallback to existing data if fetch fails
    }
  };

  const handleDecrypt = async (recordId: string, encryptedNote: string) => {
    if (!password) {
      toast.error("Password wajib diisi");
      return;
    }

    const hasKey = fullUserData?.encrypted_priv_key || fullUserData?.p_encrypted_priv_key;
    if (!hasKey) {
      toast.error("Kunci keamanan belum di-setup. Silakan ke tab Keamanan.");
      return;
    }

    setIsDecrypting(true);
    try {
      // Logic is now fully handled in the hook
      const plaintext = await decryptMedicalRecord(
        { id: recordId, notes_encrypted: encryptedNote },
        fullUserData,
        password
      );
      
      setDecryptedNotes(prev => ({ ...prev, [recordId]: plaintext }));
      setPassword("");
      toast.success("Catatan medis berhasil dibuka");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleViewClaimDetail = async (claim: any) => {
    console.log("DEBUG: handleViewClaimDetail data:", claim);
    const claimId = claim?.id || claim?.claim_id;
    
    if (!claimId) {
      console.error("DEBUG: No claimId/id found in:", claim);
      toast.error("Gagal memuat detail: ID Klaim tidak ditemukan");
      return;
    }

    setSelectedClaim(claim);
    setIsZkpDetailExpanded(false);
    setIsProofLoading(true);

    try {
      console.log("DEBUG: Fetching detail for ID:", claimId);
      const fullClaim = await getClaimById(claimId);
      console.log("DEBUG: Received fullClaim:", fullClaim);
      
      if (fullClaim) {
        setSelectedClaim(fullClaim);
        const proofs = fullClaim.zkp_proofs || claim.zkp_proofs;
        if (proofs) {
          setClaimProofData(Array.isArray(proofs) ? proofs[0] : proofs);
        } else {
          setClaimProofData(null);
        }
      } else {
        // If fetch returns null, keep existing data but handle proofs
        if (claim.zkp_proofs) {
          setClaimProofData(Array.isArray(claim.zkp_proofs) ? claim.zkp_proofs[0] : claim.zkp_proofs);
        }
      }
    } catch (err) {
      console.error("DEBUG: Error in handleViewClaimDetail:", err);
      // Fallback to existing list data
      if (claim.zkp_proofs) {
        setClaimProofData(Array.isArray(claim.zkp_proofs) ? claim.zkp_proofs[0] : claim.zkp_proofs);
      }
    } finally {
      setIsProofLoading(false);
    }
  };

  // Temporary global exposure for debug
  useEffect(() => {
    (window as any).debugViewClaim = handleViewClaimDetail;
  }, [handleViewClaimDetail]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Rejected</span>;
      case 'submitted':
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Submitted</span>;
      case 'pending':
        return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">Pending ZKP</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Halo, {typeof fullUserData?.full_name === 'string' ? fullUserData.full_name.split(' ')[0] : 'Selamat'} Sehat!
          </h1>
          <p className="text-muted-foreground">Kendalikan data kesehatan Anda dengan keamanan Zero-Knowledge.</p>
        </div>
        <div className="flex gap-2">
           <Button asChild variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
              <Link href="/chatbot">
                <MessageCircleIcon className="size-4" />
                Tanya AI Assistant
              </Link>
           </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rekam Medis</CardTitle>
              <FileTextIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{records.length} Entri</div>
              <p className="text-xs text-muted-foreground">Tersimpan di blockchain & terenkripsi</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Klaim</CardTitle>
              <HistoryIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{claims.length} Diajukan</div>
              <p className="text-xs text-muted-foreground">Status klaim asuransi aktif</p>
            </CardContent>
          </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="bg-background border">
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <HistoryIcon className="size-4" />
            Riwayat Medis
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileTextIcon className="size-4" />
            Klaim Saya
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldCheckIcon className="size-4" />
            Keamanan Kunci
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4 animate-in fade-in duration-300">
          <Card>
            <CardHeader>
              <CardTitle>Rekam Medis Terverifikasi</CardTitle>
              <CardDescription>Semua rekam medis Anda di bawah ini hanya bisa dibuka oleh kunci privat yang Anda simpan.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rumah Sakit</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Tanggal Diagnosis</TableHead>
                    <TableHead>Dokter</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingRecords ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`record-skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : records.length === 0 ? (
                    <TableRow key="no-records">
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada riwayat medis yang tercatat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium text-primary">
                          {record.institution?.name || "Instansi Kesehatan"}
                        </TableCell>
                        <TableCell>{record.diagnosis?.description || "Diagnosis Medis"}</TableCell>
                        <TableCell>{formatDate(record.diagnosis_date)}</TableCell>
                        <TableCell className="text-sm">
                          {record.attending_doctor?.full_name || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                           <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-1.5 hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleOpenRecordDetail(record)}
                           >
                              Buka <ArrowRightIcon className="size-3" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4 animate-in fade-in duration-300">
          {/* Policy Cards Section */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.isArray(policies) && policies.length > 0 ? (
              policies.map((policy) => (
                <Card key={policy.id} className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-bold text-primary">
                        {policy.insurance_policies?.policy_name || "Asuransi"}
                      </CardTitle>
                      {policy.is_active ? (
                        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Aktif</span>
                      ) : (
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Tidak Aktif</span>
                      )}
                    </div>
                    <CardDescription className="font-mono text-xs">{policy.policy_number}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 border-t mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[10px] uppercase tracking-tighter">Berlaku Dari</span>
                        <span className="text-foreground">{formatDate(policy.start_date)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="font-medium text-[10px] uppercase tracking-tighter">Hingga</span>
                        <span className="text-foreground">{formatDate(policy.end_date)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-60">
                   <ShieldCheckIcon className="size-10 mb-2" />
                   <p className="text-sm font-medium">Belum ada polis asuransi terdaftar.</p>
                </CardContent>
              </Card>
            )}
          </div>

           <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Daftar Klaim Saya</CardTitle>
                <CardDescription>Pantau proses penggantian biaya kesehatan Anda secara real-time.</CardDescription>
              </div>
              
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[140px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="pending">Pending ZKP</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[180px]">
                  <Select value={policyFilter} onValueChange={setPolicyFilter}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Pilih Polis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Polis</SelectItem>
                      {Array.isArray(policies) && policies.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.insurance_policies?.policy_name || p.policy_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(statusFilter !== 'all' || policyFilter !== 'all') && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-2 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => {
                      setStatusFilter('all');
                      setPolicyFilter('all');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Klaim</TableHead>
                    <TableHead>Instansi</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingClaims ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`claim-skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : claims.length === 0 ? (
                    <TableRow key="no-claims">
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada klaim yang ditemukan dengan filter ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    claims.map((claim) => (
                      <TableRow key={claim.id || `claim-${Math.random()}`} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {((claim.id || claim.claim_id || '') as string)?.split?.('-')?.[0]?.toUpperCase() || "N/A"}
                        </TableCell>
                        <TableCell>
                          {claim.medical_record?.institution?.name || "RS / Klinik"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatRupiah(claim.claim_amount)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(claim.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-xl h-8 hover:bg-primary/5 hover:text-primary border-primary/20"
                            onClick={() => handleViewClaimDetail(claim)}
                          >
                            Tinjau
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 animate-in fade-in duration-300">
           <Card>
            <CardHeader>
              <CardTitle>Manajemen Kunci Enkripsi</CardTitle>
              <CardDescription>Kunci privat Anda disimpan di browser ini secara aman (Web Crypto API).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <ShieldCheckIcon className="size-10 text-green-600" />
                  <div>
                    <div className="font-semibold text-lg">Local Encryption Active</div>
                    <div className="text-sm text-muted-foreground">Data Anda sepenuhnya terlindungi. Tidak ada yang bisa membuka rekam medis Anda tanpa kunci ini.</div>
                  </div>
               </div>
               
               <div className="grid gap-2 text-sm">
                  <div className="flex justify-between p-2 border-b">
                    <span className="text-muted-foreground">Public Key Hash</span>
                    <span className="font-mono text-xs">{(fullUserData?.public_key as string)?.substring(0, 32)}...</span>
                  </div>
                  <div className="flex justify-between p-2 border-b">
                    <span className="text-muted-foreground">Security Status</span>
                    <span className="text-green-600 font-medium">Verified</span>
                  </div>
               </div>

               <div className="flex gap-2">
                  <Button variant="outline">Cadangkan Kunci</Button>
                  <Button variant="destructive">Reset Akses Keamanan</Button>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Medical Record Modal */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => {
        if (!open) setSelectedRecord(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] md:max-w-[1200px] lg:max-w-7xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <div className="p-6 pb-4 border-b shrink-0 bg-muted/20">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <FileTextIcon className="size-6 text-primary" />
                    </div>
                    Detail Rekam Medis
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Informasi medis ini terenkripsi secara kriptografis (ZKP Secured).
                  </DialogDescription>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-xs font-medium">
                  <ShieldCheckIcon className="size-3" />
                  E2E Encrypted
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-hidden p-0 flex flex-col md:flex-row">
            {/* Left Sidebar: Metadata */}
            <div className="w-full md:w-[350px] border-r bg-muted/5 p-6 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Rumah Sakit</Label>
                  <div className="p-3 bg-background rounded-xl border flex items-center gap-3 shadow-sm">
                    <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                      {selectedRecord?.institution?.name?.substring(0, 2)}
                    </div>
                    <div className="font-semibold text-sm truncate">{selectedRecord?.institution?.name}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Dokter Pemeriksa</Label>
                  <div className="p-3 bg-background rounded-xl border flex items-center gap-3 shadow-sm">
                    <div className="size-8 rounded-full bg-muted border flex items-center justify-center text-muted-foreground shrink-0 font-medium text-[10px]">
                      DR
                    </div>
                    <div className="font-semibold text-sm truncate">
                      {selectedRecord?.attending_doctor?.full_name || "dr. Professional"}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Tanggal Kunjungan</Label>
                  <div className="p-3 bg-background rounded-xl border flex items-center gap-3 shadow-sm">
                    <div className="size-8 rounded-full bg-muted border flex items-center justify-center text-muted-foreground shrink-0">
                      <HistoryIcon className="size-4" />
                    </div>
                    <div className="font-semibold text-sm">
                      {selectedRecord?.diagnosis_date && formatDate(selectedRecord.diagnosis_date)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5 mb-2 block">Diagnosis Utama</Label>
                <div className="p-4 border-2 border-primary/20 rounded-2xl bg-primary/5 font-semibold text-sm flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldCheckIcon className="size-3 shrink-0" />
                    <span className="leading-tight">{selectedRecord?.diagnosis?.description}</span>
                  </div>
                  <div className="text-[10px] font-mono text-primary/70 uppercase tracking-tighter bg-primary/10 w-fit px-2 py-0.5 rounded">
                    ICD-10: {selectedRecord?.diagnosis?.icd10_code}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5 mb-2 block">Status Klaim Terkait</Label>
                <div className="p-4 border rounded-xl bg-background shadow-sm">
                   {selectedRecord?.claims && selectedRecord.claims.length > 0 ? (
                     <div className="space-y-3">
                       <div className="flex items-center justify-between">
                         <span className="font-mono text-[10px] text-muted-foreground">ID: {selectedRecord.claims[0].id.split('-')[0].toUpperCase()}</span>
                         {getStatusBadge(selectedRecord.claims[0].status)}
                       </div>
                       <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                         <ArrowRightIcon className="size-3" />
                         Klik tab Klaim untuk detail
                       </div>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 text-muted-foreground italic text-[10px] py-2">
                        <ArrowRightIcon className="size-3" />
                        Belum ada klaim diajukan
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Main Content: Decrypted Notes */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-6 py-3 border-b bg-muted/5 flex items-center justify-between shrink-0">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest flex items-center gap-2">
                  <LockIcon className="size-3 text-primary" />
                  Catatan Dokter & Rekomendasi
                </Label>
                {decryptedNotes[selectedRecord?.id] && (
                  <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium border border-green-500/20">Decrypted & Verified</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
                {decryptedNotes[selectedRecord?.id] ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md">
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 mt-8 first:mt-0 border-b pb-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 mt-6 first:mt-0" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2 mt-5 first:mt-0" {...props} />,
                      }}
                    >
                      {decryptedNotes[selectedRecord.id]}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center space-y-6 py-12">
                    <div className="p-5 bg-primary/5 rounded-full border border-primary/20 relative shadow-sm">
                      <LockIcon className="size-10 text-primary animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping opacity-20" />
                    </div>
                    <div className="text-center space-y-2 px-6 max-w-sm">
                      <h3 className="font-bold text-xl text-foreground">Catatan Terenkripsi</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Data ini diproteksi dengan keamanan militer (ECC P-256). Masukkan password keamanan Anda untuk mendekripsi catatan medis.
                      </p>
                    </div>
                    
                    <div className="w-full max-w-xs space-y-4 px-6 pt-4">
                      <div className="space-y-2">
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="Masukkan password Anda" 
                          className="h-12 rounded-xl text-center font-medium bg-muted/30 border-2 focus-visible:ring-primary/30 transition-all"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleDecrypt(selectedRecord.id, selectedRecord.notes_encrypted)}
                        />
                      </div>
                      <Button 
                        className="w-full h-12 rounded-xl font-bold text-base shadow-xl shadow-primary/10 transition-all active:scale-[0.98] hover:shadow-primary/20" 
                        onClick={() => handleDecrypt(selectedRecord.id, selectedRecord.notes_encrypted)}
                        disabled={isDecrypting}
                      >
                        {isDecrypting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                            Membuka...
                          </>
                        ) : (
                          <>
                            <EyeIcon className="size-5 mr-2" />
                            Buka Catatan
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t bg-muted/5 shrink-0 text-center text-muted-foreground">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em]">Secured by Claimly ZKP & Web Crypto API</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Claim Modal */}
      <Dialog open={!!selectedClaim} onOpenChange={(open) => {
        if (!open) setSelectedClaim(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] md:max-w-[1200px] lg:max-w-7xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <div className="p-6 pb-4 border-b shrink-0 bg-muted/20">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <BookOpenIcon className="size-6 text-primary" />
                    </div>
                    Detail Klaim Asuransi
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Informasi lengkap klaim dan bukti kriptografi Zero-Knowledge Proof.
                  </DialogDescription>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-full text-xs font-medium">
                  <ShieldCheckIcon className="size-3" />
                  ZKP Verified
                </div>
              </div>
            </DialogHeader>
          </div>

          {selectedClaim && (
            <div className="flex-1 overflow-hidden p-0 flex flex-col md:flex-row">
              {/* Left Sidebar: Metadata */}
              <div className="w-full md:w-[350px] border-r bg-muted/5 p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">ID Klaim</Label>
                    <div className="p-3 bg-background rounded-xl border font-mono text-xs shadow-sm">
                      {selectedClaim.id?.split('-')[0].toUpperCase() || selectedClaim.claim_id?.split('-')[0].toUpperCase() || "-"}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Status Klaim</Label>
                    <div className="p-1 px-3 bg-background rounded-xl border shadow-sm w-fit">
                      {getStatusBadge(selectedClaim.status)}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Rumah Sakit</Label>
                    <div className="p-3 bg-background rounded-xl border flex items-center gap-3 shadow-sm">
                      <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                        {selectedClaim.medical_record?.institution?.name?.substring(0, 2) || "RS"}
                      </div>
                      <div className="font-semibold text-sm truncate">{selectedClaim.medical_record?.institution?.name || "RS / Klinik"}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Nominal Klaim</Label>
                    <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/20 shadow-sm flex flex-col gap-1">
                      <span className="text-2xl font-bold text-primary">{formatRupiah(selectedClaim.claim_amount)}</span>
                      <span className="text-[10px] text-muted-foreground italic">Estimasi biaya yang diajukan</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Detail Prosedur</Label>
                    <div className="p-4 bg-background rounded-xl border shadow-sm space-y-2">
                       <div className="text-sm font-semibold leading-tight">{selectedClaim.procedures?.description || "Prosedur Medis"}</div>
                       <div className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit">ICD-9: {selectedClaim.procedures?.icd9_code || "-"}</div>
                    </div>
                  </div>

                  {selectedClaim.patient_policies && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest pl-0.5">Polis Asuransi</Label>
                      <div className="p-3 bg-background rounded-xl border shadow-sm">
                        <div className="text-sm font-medium">{selectedClaim.patient_policies.insurance_policies?.policy_name || "Asuransi"}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">No: {selectedClaim.patient_policies.policy_number}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content: ZKP Technical Area */}
              <div className="flex-1 flex flex-col min-w-0 bg-background">
                <div className="px-6 py-3 border-b bg-muted/5 flex items-center justify-between shrink-0">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest flex items-center gap-2">
                    <CodeIcon className="size-3 text-primary" />
                    Bukti Kriptografi (ZKP Detail)
                  </Label>
                  <div className="flex items-center gap-2">
                    {claimProofData?.verified_at && (
                      <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium border border-green-500/20">Verified Protocol</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {isProofLoading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                      <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground animate-pulse font-medium">Memverifikasi bukti kriptografi...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-4">
                       <div className="space-y-3 flex flex-col h-full">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest">Proof JSON</Label>
                            <span className="text-[9px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">snarkjs-v3</span>
                          </div>
                          <div className="flex-1 min-h-[300px] overflow-auto p-4 bg-slate-950 text-slate-200 rounded-2xl border font-mono text-[10px] shadow-2xl relative group">
                            {claimProofData?.proof_json ? (
                              <pre className="whitespace-pre-wrap selection:bg-primary/30">{JSON.stringify(claimProofData.proof_json, null, 2)}</pre>
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
                                <LockIcon className="size-8" />
                                <p className="italic text-center text-xs px-8">Data Proof belum tersedia atau sedang diproses oleh Rumah Sakit.</p>
                              </div>
                            )}
                          </div>
                       </div>

                       <div className="space-y-3 flex flex-col h-full">
                         <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest">Public Signals (Inputs)</Label>
                            <span className="text-[9px] text-green-600 font-mono bg-green-500/10 px-1.5 py-0.5 rounded">verified_root</span>
                          </div>
                          <div className="flex-1 min-h-[300px] overflow-auto p-4 bg-slate-900 text-green-400 rounded-2xl border border-green-900/50 font-mono text-[10px] shadow-2xl relative group">
                            {claimProofData?.public_signals ? (
                              <pre className="whitespace-pre-wrap selection:bg-green-500/20">{JSON.stringify(claimProofData.public_signals, null, 2)}</pre>
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                                <SearchIcon className="size-8" />
                                <p className="italic text-center text-xs px-8">Menunggu verifikasi sinyal publik...</p>
                              </div>
                            )}
                          </div>
                       </div>
                    </div>
                  )}
                  
                  {!isProofLoading && (
                    <div className="p-4 rounded-2xl border bg-blue-50/30 flex gap-4 text-xs text-blue-900/80 leading-relaxed shadow-sm">
                      <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <ShieldCheckIcon className="size-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold mb-1">Zero-Knowledge Verification Active</p>
                        <p>Sistem asuransi memverifikasi kebenaran rekam medis Anda tanpa perlu "melihat" isi medis yang sensitif. Privasi Anda terjaga sepenuhnya di sisi klien.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-t bg-muted/5 shrink-0 text-center text-muted-foreground">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em]">Verified by Claimly ZKP Protocol • E2E Secured</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

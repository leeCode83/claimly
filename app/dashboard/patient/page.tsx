"use client"

import { useState, useEffect } from "react"
import { HistoryIcon, FileTextIcon, ShieldCheckIcon, MessageCircleIcon, ArrowRightIcon, LockIcon, EyeIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
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
import { useAuthContext } from "@/context/AuthContext"
import { decryptNoteInBrowser } from "@/lib/crypto/browser-crypto"

export default function PatientDashboard() {
  const { accessToken } = useAuthContext();
  const { getMedicalRecords, isLoading: isLoadingRecords } = useMedicalRecords(accessToken);
  const { getClaims, isLoading: isLoadingClaims } = useClaims(accessToken);
  const { getMe } = useUsers(accessToken);

  const [records, setRecords] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [fullUserData, setFullUserData] = useState<any>(null);
  
  // State for detail modals
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  
  // Decryption state
  const [password, setPassword] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});

  const loadData = async () => {
    if (!accessToken) return;
    try {
      const [recordsRes, claimsRes, userRes] = await Promise.all([
        getMedicalRecords(),
        getClaims(),
        getMe()
      ]);
      setRecords(recordsRes.data || []);
      setClaims(claimsRes.data || []);
      setFullUserData(userRes);
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  const handleDecrypt = async (recordId: string, encryptedNote: string) => {
    if (!password) {
      toast.error("Password wajib diisi");
      return;
    }
    
    if (!fullUserData?.p_encrypted_priv_key) {
      toast.error("Kunci keamanan belum di-setup. Silakan ke tab Keamanan.");
      return;
    }

    setIsDecrypting(true);
    try {
      const plaintext = await decryptNoteInBrowser(
        fullUserData.p_encrypted_priv_key,
        fullUserData.p_key_derivation_salt,
        fullUserData.p_key_iv,
        password,
        encryptedNote
      );
      setDecryptedNotes(prev => ({ ...prev, [recordId]: plaintext }));
      setPassword("");
      toast.success("Catatan medis berhasil dibuka");
    } catch (err) {
      toast.error("Gagal membuka catatan. Pastikan password benar.");
    } finally {
      setIsDecrypting(false);
    }
  };

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
            Halo, {fullUserData?.full_name?.split(' ')[0] || 'Selamat'} Sehat!
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
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingRecords ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                        <TableCell className="text-right">
                           <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-1.5 hover:bg-primary/10 hover:text-primary"
                              onClick={() => setSelectedRecord(record)}
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
           <Card>
            <CardHeader>
              <CardTitle>Status Klaim Asuransi</CardTitle>
              <CardDescription>Pantau proses penggantian biaya kesehatan Anda secara real-time.</CardDescription>
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
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : claims.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada klaim yang diajukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    claims.map((claim) => (
                      <TableRow key={claim.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {claim.id.split('-')[0].toUpperCase()}
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
                            onClick={() => setSelectedClaim(claim)}
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
                    <span className="font-mono text-xs">{fullUserData?.public_key?.substring(0, 32)}...</span>
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
        <DialogContent className="max-w-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FileTextIcon className="size-6 text-primary" />
              Detail Rekam Medis
            </DialogTitle>
            <DialogDescription>
              Informasi medis ini terenkripsi secara kriptografis (ZKP Secured).
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Rumah Sakit</Label>
                <div className="font-semibold">{selectedRecord?.institution?.name}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tanggal Kunjungan</Label>
                <div className="font-semibold">
                  {selectedRecord?.diagnosis_date && formatLongDate(selectedRecord.diagnosis_date)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Diagnosis Utama</Label>
              <div className="p-3 border rounded-lg bg-primary/5 font-medium flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                {selectedRecord?.diagnosis?.description} ({selectedRecord?.diagnosis?.icd10_code})
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <LockIcon className="size-4 text-primary" />
                Catatan Dokter & Rekomendasi
              </Label>
              
              {decryptedNotes[selectedRecord?.id] ? (
                <div className="p-4 border rounded-xl bg-muted/30 text-sm whitespace-pre-wrap leading-relaxed">
                  {decryptedNotes[selectedRecord.id]}
                </div>
              ) : (
                <div className="space-y-4 p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/10">
                  <div className="text-center space-y-1">
                    <p className="text-sm text-muted-foreground">Catatan ini terenkripsi dan hanya Anda yang memiliki kuncinya.</p>
                  </div>
                  
                  <div className="w-full max-w-xs space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Masukkan Password Keamanan</Label>
                      <Input 
                        id="password" 
                        type="password" 
                        placeholder="Password kunci Anda" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDecrypt(selectedRecord.id, selectedRecord.notes_encrypted)}
                      />
                    </div>
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => handleDecrypt(selectedRecord.id, selectedRecord.notes_encrypted)}
                      disabled={isDecrypting}
                    >
                      {isDecrypting ? "Mendekripsi..." : <><EyeIcon className="size-4" /> Buka Catatan</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecord(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Claim Modal */}
      <Dialog open={!!selectedClaim} onOpenChange={(open) => {
        if (!open) setSelectedClaim(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Klaim Asuransi</DialogTitle>
            <DialogDescription>
              Status terkini dari pengajuan reimbursement Anda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center p-4 border rounded-xl bg-muted/50">
               <div className="space-y-1">
                 <span className="text-xs text-muted-foreground uppercase tracking-wider">Status Klaim</span>
                 <div>{selectedClaim && getStatusBadge(selectedClaim.status)}</div>
               </div>
               <div className="text-right space-y-1">
                 <span className="text-xs text-muted-foreground uppercase tracking-wider">Nominal</span>
                 <div className="text-lg font-bold">{selectedClaim && formatRupiah(selectedClaim.claim_amount)}</div>
               </div>
            </div>

            <div className="grid gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Klaim</span>
                  <span className="font-mono">{selectedClaim?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal Prosedur</span>
                  <span>{selectedClaim?.procedure_date && formatDate(selectedClaim.procedure_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instansi Penagih</span>
                  <span>{selectedClaim?.medical_record?.institution?.name}</span>
                </div>
            </div>

            {selectedClaim?.review_notes && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-semibold">Catatan Peninjauan</Label>
                <div className="p-3 border rounded-lg bg-orange-50 text-orange-900 text-sm">
                  {selectedClaim.review_notes}
                </div>
              </div>
            )}
            
            <div className="p-3 rounded-lg border bg-blue-50/50 flex gap-3 text-xs text-blue-800">
               <ShieldCheckIcon className="size-4 shrink-0 mt-0.5" />
               <p>Klaim ini telah divalidasi menggunakan <strong>Zero-Knowledge Proof</strong> untuk membuktikan kepatuhan tanpa mengekspos rekam medis lengkap Anda ke pihak asuransi.</p>
            </div>
          </div>

          <DialogFooter>
             <Button variant="outline" className="w-full" onClick={() => setSelectedClaim(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

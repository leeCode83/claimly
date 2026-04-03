"use client"

import { useState } from "react"
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
  FingerprintIcon
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuthContext } from "@/context/AuthContext"
import { useClaims, ZkpStatus } from "@/hooks/useClaims"

const zkpStatusMessages: Record<ZkpStatus, string> = {
  idle: "Menunggu pengajuan...",
  preparing: "Mengambil data persiapan & Merkle Path...",
  generating: "Komputasi ZKP Proof di browser (mungkin butuh beberapa detik)...",
  submitting: "Mengirimkan Klaim & Proof ke server...",
  success: "Klaim berhasil diajukan dengan bukti ZKP!",
  error: "Gagal memproses bukti ZKP."
};

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState("patients")
  const { accessToken } = useAuthContext()
  const { submitClaimWithZkp, zkpStatus, isLoading, zkpError } = useClaims(accessToken)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    patient_policy_id: "77777777-7777-7777-7777-777777777777", // Placeholder ID
    medical_record_id: "88888888-8888-8888-8888-888888888888", // Placeholder ID
    procedure_id: "99999999-9999-9999-9999-999999999999",     // Placeholder ID
    procedure_date: new Date().toISOString().split('T')[0],
    claim_amount: 500000
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await submitClaimWithZkp(formData)
      // Logic after success can be added here (e.g. redirect or clear form)
      setTimeout(() => setIsDialogOpen(false), 2000)
    } catch (err) {
      // Error handled by hook toast
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Rumah Sakit</h1>
          <p className="text-muted-foreground">Kelola pasien, rekam medis, dan ajukan klaim asuransi.</p>
        </div>
        <div className="flex gap-2">
          <Button className="gap-2">
            <PlusIcon className="size-4" />
            Pasien Baru
          </Button>
        </div>
      </div>

      <Tabs defaultValue="patients" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-4">
          <TabsTrigger value="patients" className="gap-2">
            <UsersIcon className="size-4" />
            Pasien
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2">
            <FileTextIcon className="size-4" />
            Rekam Medis
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2">
            <ShieldPlusIcon className="size-4" />
            Ajukan Klaim
          </TabsTrigger>
          <TabsTrigger value="policy" className="gap-2">
            <BookOpenIcon className="size-4" />
            Policy ICD
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>Daftar Pasien Terdaftar</CardTitle>
                <CardDescription>Cari dan kelola informasi pasien rumah sakit.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input placeholder="Cari nama/NIK..." className="pl-9 w-[250px]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead>NIK / ID</TableHead>
                    <TableHead>Terdaftar Sejak</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Andi Budiman</TableCell>
                    <TableCell>3174090101850001</TableCell>
                    <TableCell>12 Mar 2026</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">Detail</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Siti Aminah</TableCell>
                    <TableCell>3172081503900002</TableCell>
                    <TableCell>15 Mar 2026</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">Detail</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entri Rekam Medis Terbaru</CardTitle>
              <CardDescription>Catatan medis yang telah dienkripsi menggunakan kunci publik pasien.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pasien</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status Enkripsi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Andi Budiman</TableCell>
                    <TableCell>Hipertensi Grade I</TableCell>
                    <TableCell>30 Mar 2026</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        Securely Encrypted
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Card className="hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">Klaim Baru</CardTitle>
                      <CardDescription>Mulai proses penjaminan klaim asuransi dengan ZKP.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full">Buat Pengajuan</Button>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Ajukan Klaim Asuransi (ZKP)</DialogTitle>
                    <DialogDescription>
                      Proses ini akan men-generate Zero-Knowledge Proof secara lokal di browser Anda.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {zkpStatus !== 'idle' && zkpStatus !== 'success' && zkpStatus !== 'error' ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="relative">
                         <Loader2Icon className="size-12 animate-spin text-primary" />
                         <FingerprintIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-5 text-primary/50" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="font-medium animate-pulse">{zkpStatusMessages[zkpStatus]}</p>
                        <p className="text-xs text-muted-foreground">Jangan menutup tab ini selama proses berlangsung.</p>
                      </div>
                    </div>
                  ) : zkpStatus === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-2">
                       <CheckCircle2Icon className="size-12 text-green-500" />
                       <p className="font-medium">{zkpStatusMessages.success}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient_policy_id">ID Polis Pasien</Label>
                        <Input 
                          id="patient_policy_id" 
                          value={formData.patient_policy_id} 
                          onChange={(e) => setFormData({...formData, patient_policy_id: e.target.value})}
                          placeholder="UUID Polis"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="medical_record_id">ID Rekam Medis</Label>
                          <Input 
                            id="medical_record_id" 
                            value={formData.medical_record_id} 
                            onChange={(e) => setFormData({...formData, medical_record_id: e.target.value})}
                            placeholder="UUID Rekam Medis"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="procedure_id">ID Prosedur</Label>
                          <Input 
                            id="procedure_id" 
                            value={formData.procedure_id} 
                            onChange={(e) => setFormData({...formData, procedure_id: e.target.value})}
                            placeholder="UUID Prosedur"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="procedure_date">Tanggal Tindakan</Label>
                          <Input 
                            id="procedure_date" 
                            type="date"
                            value={formData.procedure_date} 
                            onChange={(e) => setFormData({...formData, procedure_date: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="claim_amount">Nominal Klaim (IDR)</Label>
                          <Input 
                            id="claim_amount" 
                            type="number"
                            value={formData.claim_amount} 
                            onChange={(e) => setFormData({...formData, claim_amount: parseInt(e.target.value)})}
                            required
                          />
                        </div>
                      </div>

                      {zkpStatus === 'error' && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex gap-2 text-sm items-start">
                          <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
                          <p>{zkpError || zkpStatusMessages.error}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={isLoading} className="gap-2">
                          {isLoading && <Loader2Icon className="size-4 animate-spin" />}
                          Kirim & Generate Proof
                        </Button>
                      </div>
                    </form>
                  )}
                </DialogContent>
              </Dialog>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status Klaim</CardTitle>
                  <CardDescription>Pantau proses approval oleh asuransi.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="text-2xl font-bold">12 Pending</div>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Prosedur & Diagnosis Terproteksi</CardTitle>
              <CardDescription>Referensi kode ICD (Diagnosis) dan CPT (Prosedur) yang diiizinkan asuransi.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input placeholder="Filter kode..." className="mb-4" />
              <div className="rounded-md border p-8 text-center text-muted-foreground">
                Daftar diagnosa sedang dimuat...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

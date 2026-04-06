"use client"

import { useState, useEffect } from "react"
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

import { usePatients } from "@/hooks/usePatients"
import { useInsurancePolicies } from "@/hooks/useInsurancePolicies"
import { useMedicalRecords } from "@/hooks/useMedicalRecords"
import { useDiagnoses } from "@/hooks/useDiagnoses"

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
  verifying: "Menunggu verifikasi sistem (Asynchronous MQ)...",
  success: "Klaim berhasil diverifikasi dan disetujui!",
  error: "Gagal memproses bukti ZKP atau verifikasi ditolak."
};

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState("patients")
  const { accessToken } = useAuthContext()
  const { submitClaimWithZkp, zkpStatus, isLoading, zkpError } = useClaims(accessToken)
  
  const { getPatients, getPatient, registerPatient, addPatientPolicy, isLoading: isPatientOpLoading } = usePatients(accessToken)
  const { getPolicies } = useInsurancePolicies(accessToken)
  const { getMedicalRecords, createMedicalRecord, isLoading: isMedRecLoading } = useMedicalRecords(accessToken)
  const { getDiagnoses } = useDiagnoses(accessToken)

  // Insurance Policies for Select
  const [policiesData, setPoliciesData] = useState<any[]>([])

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

  // Patient Detail & Policy State
  const [isPatientDetailOpen, setIsPatientDetailOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [patientDetail, setPatientDetail] = useState<any | null>(null)
  const [isPatientDetailLoading, setIsPatientDetailLoading] = useState(false)
  
  const [isAddPolicyMode, setIsAddPolicyMode] = useState(false)
  const [newPolicyForm, setNewPolicyForm] = useState({
    policy_id: "",
    policy_number: "",
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  })
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    patient_policy_id: "77777777-7777-7777-7777-777777777777", // Placeholder ID
    medical_record_id: "88888888-8888-8888-8888-888888888888", // Placeholder ID
    procedure_id: "99999999-9999-9999-9999-999999999999",     // Placeholder ID
    procedure_date: new Date().toISOString().split('T')[0],
    claim_amount: 500000
  })

  const [medicalRecords, setMedicalRecords] = useState<any[]>([])
  const [isRecordsLoading, setIsRecordsLoading] = useState(false)
  const [isNewRecordOpen, setIsNewRecordOpen] = useState(false)
  const [diagnoses, setDiagnoses] = useState<any[]>([])
  const [newRecordForm, setNewRecordForm] = useState({
    patient_id: "",
    diagnosis_id: "",
    diagnosis_date: new Date().toISOString().split('T')[0],
    notes: ""
  })

  const loadPatients = async () => {
    setIsPatientLoading(true)
    try {
      const res = await getPatients()
      setPatients(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setIsPatientLoading(false)
    }
  }

  const loadMedicalRecords = async () => {
    setIsRecordsLoading(true)
    try {
      const res = await getMedicalRecords()
      if (res && res.data) {
        setMedicalRecords(res.data)
      } else {
        setMedicalRecords(res || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsRecordsLoading(false)
    }
  }

  const loadDiagnosesData = async () => {
    try {
      const res = await getDiagnoses({ limit: 100 })
      setDiagnoses(res.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  // Load patient list and policies when opening tab
  useEffect(() => {
    if (accessToken) {
      if (activeTab === "patients") {
        loadPatients()
        getPolicies({ limit: 100 }).then(res => setPoliciesData(res.data || [])).catch(console.error)
      } else if (activeTab === "records") {
        loadMedicalRecords()
        if (patients.length === 0) loadPatients()
        loadDiagnosesData()
      }
    }
  }, [accessToken, activeTab, getPatients, getPolicies, getMedicalRecords, getDiagnoses])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await submitClaimWithZkp(formData)
      setTimeout(() => setIsDialogOpen(false), 2000)
    } catch (err) { }
  }

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = { ...newPatientForm }
      if (!payload.user_id) delete payload.user_id // Opsional

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
      
      // Reload details after adding policy
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
              {/* Profile Card */}
              <div className="rounded-lg border p-4 grid grid-cols-2 gap-4 bg-muted/20">
                <div>
                  <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                  <p className="font-medium">{patientDetail.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID Pasien</p>
                  <p className="font-mono text-xs mt-0.5">{patientDetail.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tahun Lahir & Gender</p>
                  <p className="font-medium">{patientDetail.birth_year} &bull; {patientDetail.gender === 'M' ? 'Laki-laki' : 'Perempuan'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">User UUID Terikat</p>
                  <p className="font-mono text-xs mt-0.5 truncate" title={patientDetail.user_id || "Belum ditautkan"}>{patientDetail.user_id || "Belum ditautkan"}</p>
                </div>
              </div>

              {/* Policies List */}
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
                  <form onSubmit={handleAddPolicy} className="rounded-lg border p-4 space-y-4 bg-muted/10 animate-in fade-in zoom-in-95 duration-200">
                    <h4 className="font-medium text-sm">Form Tambah Polis</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="policy_id">Polis Induk (Asuransi) <span className="text-destructive">*</span></Label>
                        <select 
                          id="policy_id" 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                          value={newPolicyForm.policy_id}
                          onChange={(e) => setNewPolicyForm({...newPolicyForm, policy_id: e.target.value})}
                          required
                        >
                          <option value="" disabled>Pilih Polis...</option>
                          {policiesData.map((pol: any) => (
                            <option key={pol.id} value={pol.id}>{pol.policy_name || `Polis ID: ${pol.id.substring(0,8)}`}</option>
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
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${policy.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {policy.is_active ? 'AKTIF' : 'NON-AKTIF'}
                              </span>
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
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Rumah Sakit</h1>
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
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                    patients.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.full_name || "Tidak ada nama"}</TableCell>
                        <TableCell>{p.gender === 'M' ? 'Laki-laki' : p.gender === 'F' ? 'Perempuan' : p.gender}</TableCell>
                        <TableCell>{p.birth_year || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{p.id.split('-')[0]}...</TableCell>
                        <TableCell>{new Date(p.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetail(p.id)}>Detail</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Tambah Rekam Medis</DialogTitle>
                    <DialogDescription>
                      Isi data diagnosis dan prosedur pasien. Catatan (optional) akan dienkripsi secara aman.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateRecord} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="patient_id">Pilih Pasien <span className="text-destructive">*</span></Label>
                      <select 
                        id="patient_id"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newRecordForm.patient_id}
                        onChange={(e) => setNewRecordForm({...newRecordForm, patient_id: e.target.value})}
                        required
                      >
                        <option value="" disabled>Pilih Pasien...</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>{p.full_name} ({p.nik})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diagnosis_id">Diagnosis <span className="text-destructive">*</span></Label>
                      <select 
                        id="diagnosis_id"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newRecordForm.diagnosis_id}
                        onChange={(e) => setNewRecordForm({...newRecordForm, diagnosis_id: e.target.value})}
                        required
                      >
                        <option value="" disabled>Pilih Diagnosis...</option>
                        {diagnoses.map((d) => (
                          <option key={d.id} value={d.id}>{d.description} ({d.icd10_code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diagnosis_date">Tanggal Diagnosis <span className="text-destructive">*</span></Label>
                      <Input 
                        id="diagnosis_date" 
                        type="date"
                        value={newRecordForm.diagnosis_date}
                        onChange={(e) => setNewRecordForm({...newRecordForm, diagnosis_date: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Catatan Medis (Opsional)</Label>
                      <textarea
                        id="notes"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Catatan tambahan..."
                        value={newRecordForm.notes}
                        onChange={(e) => setNewRecordForm({...newRecordForm, notes: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">Catatan akan dienkripsi E2EE dengan kunci publik pasien.</p>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setIsNewRecordOpen(false)}>Batal</Button>
                      <Button type="submit" disabled={isMedRecLoading}>
                        {isMedRecLoading && <Loader2Icon className="size-4 animate-spin mr-2" />}
                        Simpan
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Rekam Medis</TableHead>
                    <TableHead>Pasien</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status Enkripsi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRecordsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6">
                        <Loader2Icon className="size-6 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Memuat data rekam medis...</p>
                      </TableCell>
                    </TableRow>
                  ) : medicalRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada data rekam medis.
                      </TableCell>
                    </TableRow>
                  ) : (
                    medicalRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs font-mono">{record.id.substring(0,8)}...</TableCell>
                        <TableCell className="font-medium">{record.patient?.full_name || record.patient_id.substring(0,8)}</TableCell>
                        <TableCell>{record.diagnosis?.description || record.diagnosis_id?.substring(0,8) || "-"}</TableCell>
                        <TableCell>{new Date(record.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          {record.notes_encrypted ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-medium text-green-800">
                              Securely Encrypted
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-800">
                              No Notes
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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

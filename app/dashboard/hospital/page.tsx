"use client"

import { useState } from "react"
import { ShieldPlusIcon, UsersIcon, FileTextIcon, HistoryIcon, BookOpenIcon, PlusIcon, SearchIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState("patients")

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
                  {/* Mock Data for demo purposes */}
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
           {/* Placeholder for Claim Submission Feature */}
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">Klaim Baru</CardTitle>
                  <CardDescription>Mulai proses penjaminan klaim asuransi.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Buat Pengajuan</Button>
                </CardContent>
              </Card>
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

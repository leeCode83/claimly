"use client"

import { useState } from "react"
import { ShieldAlertIcon, CheckCircle2Icon, XCircleIcon, HistoryIcon, Settings2Icon, SearchIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function InsuranceDashboard() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Asuransi</h1>
          <p className="text-muted-foreground">Review klaim medis menggunakan verifikasi ZKP tanpa mengakses data privat.</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-3">
          <TabsTrigger value="pending" className="gap-2">
            <ShieldAlertIcon className="size-4" />
            Review Klaim
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <HistoryIcon className="size-4" />
            Riwayat
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2Icon className="size-4" />
            Aturan Polis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Antrean Review Klaim</CardTitle>
              <CardDescription>Klaim yang membutuhkan verifikasi bukti ZKP (Zero Knowledge Proof).</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rumah Sakit</TableHead>
                    <TableHead>Bukti ZKP</TableHead>
                    <TableHead>Status Verifikasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">RS Medika Jakarta</TableCell>
                    <TableCell>ZKP-Proof-8192-A</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Waiting Verification
                      </span>
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="text-green-600 hover:bg-green-50">Approve</Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">Reject</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Pengajuan</CardTitle>
              <CardDescription>Daftar klaim yang telah diproses.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Klaim</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>CLM-001</TableCell>
                    <TableCell>25 Mar 2026</TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1.5 text-green-600 font-medium">
                          <CheckCircle2Icon className="size-4" /> Approved
                       </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Konfigurasi Diagnosis & Prosedur</CardTitle>
              <CardDescription>Atur diagnosa mana yang di-cover oleh polis asuransi ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-24 justify-start p-4 gap-4">
                  <Settings2Icon className="size-6" />
                  <div className="text-left">
                    <div className="font-semibold">Update Daftar ICD-10</div>
                    <div className="text-sm text-muted-foreground">Kelola kode diagnosis.</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-24 justify-start p-4 gap-4">
                  <ShieldAlertIcon className="size-6 text-primary" />
                  <div className="text-left">
                    <div className="font-semibold">Threshold Fraud Detection</div>
                    <div className="text-sm text-muted-foreground">Aturan validasi ZKP.</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

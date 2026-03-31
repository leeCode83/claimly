"use client"

import { useState } from "react"
import { HistoryIcon, FileTextIcon, ShieldCheckIcon, MessageCircleIcon, ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function PatientDashboard() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Halo, Selamat Sehat!</h1>
          <p className="text-muted-foreground">Kendalikan data kesehatan Anda dengan keamanan Zero-Knowledge.</p>
        </div>
        <div className="flex gap-2">
           <Button asChild variant="outline" className="gap-2">
              <Link href="/chatbot">
                <MessageCircleIcon className="size-4" />
                Tanya AI Assistant
              </Link>
           </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rekam Medis</CardTitle>
              <FileTextIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5 Entri</div>
              <p className="text-xs text-muted-foreground">Terakhir: 30 Mar 2026</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Klaim Terkirim</CardTitle>
              <HistoryIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2 Aktif</div>
              <p className="text-xs text-muted-foreground">Status: In Review</p>
            </CardContent>
          </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history" className="gap-2">
            <HistoryIcon className="size-4" />
            Riwayat Medis
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2">
            <FileTextIcon className="size-4" />
            Klaim Saya
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <ShieldCheckIcon className="size-4" />
            Keamanan Kunci
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
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
                  <TableRow>
                    <TableCell className="font-medium">RS Medika Jakarta</TableCell>
                    <TableCell>Hipertensi Grade I</TableCell>
                    <TableCell>30 Mar 2026</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="gap-1.5">
                          Buka <ArrowRightIcon className="size-3" />
                       </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Status Klaim Asuransi</CardTitle>
              <CardDescription>Pantau proses penggantian biaya kesehatan Anda.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Klaim</TableHead>
                    <TableHead>Instansi</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>CLM-0921</TableCell>
                    <TableCell>BPJS / Prudential</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        Analyzing Proof
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
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
               <div className="flex gap-2">
                  <Button variant="outline">Cadangkan Kunci</Button>
                  <Button variant="destructive">Reset Akses Keamanan</Button>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useState } from "react"
import { UsersIcon, Building2Icon, ShieldAlertIcon, PlusIcon, SearchIcon, ActivityIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pusat Administrasi</h1>
          <p className="text-muted-foreground">Kelola pengguna sistem, institusi resmi, dan audit log.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="default" className="gap-2">
              <PlusIcon className="size-4" />
              Institusi Baru
            </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total User</CardTitle>
              <UsersIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">128</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktif Rumah Sakit</CardTitle>
              <Building2Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status Sistem</CardTitle>
              <ActivityIcon className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Healthy</div>
            </CardContent>
          </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <UsersIcon className="size-4" />
            Kelola User
          </TabsTrigger>
          <TabsTrigger value="institutions" className="gap-2">
            <Building2Icon className="size-4" />
            Instansi
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ShieldAlertIcon className="size-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Pengguna Platform</CardTitle>
              <CardDescription>Semua staf rumah sakit, asuransi, dan administrator sistem.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input placeholder="Cari email/nama..." className="pl-9" />
                  </div>
               </div>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Instansi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                     <TableCell>
                        <div className="flex flex-col">
                           <span className="font-medium text-sm">Ale Admin</span>
                           <span className="text-xs text-muted-foreground">ale@kalbe.co.id</span>
                        </div>
                     </TableCell>
                     <TableCell>Admin</TableCell>
                     <TableCell>CDT Kalbe</TableCell>
                     <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Edit</Button>
                     </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="institutions" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Daftar Rumah Sakit & Asuransi</CardTitle>
              <CardDescription>Mendaftarkan institusi baru untuk mengakses platform.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Institusi</TableHead>
                    <TableHead>Tipe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">RS Medika Jakarta</TableCell>
                    <TableCell>Hospital</TableCell>
                  </TableRow>
                   <TableRow>
                    <TableCell className="font-medium">BPJS Kesehatan</TableCell>
                    <TableCell>Insurance</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Keamanan & Audit Sistem</CardTitle>
              <CardDescription>Riwayat aktivitas kritikal sistem.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="rounded-md border bg-zinc-950 p-4 font-mono text-xs text-zinc-400">
                  <div className="text-zinc-500">[2026-03-31 20:00:01] Auth: User Ale Sign In success.</div>
                  <div className="text-zinc-500">[2026-03-31 20:05:12] ZKP: Proof CLM-0921 verified for BPJS.</div>
                  <div className="text-zinc-500">[2026-03-31 20:10:45] Admin: Added new Institution: RS Kalbe.</div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

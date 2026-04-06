"use client"

import { useState, useEffect } from "react"
import { UsersIcon, Building2Icon, ShieldAlertIcon, PlusIcon, SearchIcon, ActivityIcon, EyeIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useInstitutions } from "@/hooks/useInstitutions"
import { useUsers } from "@/hooks/useUsers"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminDashboard() {
  const { getInstitutions, getInstitution, isLoading: isInstLoading } = useInstitutions()
  const { getUsers, getUserById, updateUser, deleteUser, isLoading: isUserLoading } = useUsers()
  
  const [institutions, setInstitutions] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const [users, setUsers] = useState<any[]>([])
  const [userPage, setUserPage] = useState(1)
  const [userTotalPages, setUserTotalPages] = useState(1)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isUserDetailLoading, setIsUserDetailLoading] = useState(false)
  const [isUserEditMode, setIsUserEditMode] = useState(false)
  const [editUserForm, setEditUserForm] = useState<any>({})

  const limit = 5

  useEffect(() => {
    fetchUsers(userPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage])

  useEffect(() => {
    fetchInstitutions(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const fetchUsers = async (currentPage: number) => {
    try {
      const res = await getUsers({ page: currentPage, limit })
      setUsers(res.data || [])
      setUserTotalPages(res.pagination?.total_pages || 1)
    } catch (error) {
      console.error(error)
    }
  }

  const handleOpenUserDetail = async (id: string) => {
    setIsUserModalOpen(true)
    setIsUserDetailLoading(true)
    setIsUserEditMode(false)
    setSelectedUser(null)
    try {
      const u = await getUserById(id)
      setSelectedUser(u)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUserDetailLoading(false)
    }
  }

  const handleEditUserToggle = () => {
    const nextMode = !isUserEditMode;
    setIsUserEditMode(nextMode)
    if (nextMode && selectedUser) {
      setEditUserForm({
        full_name: selectedUser.full_name || "",
        role: selectedUser.role || "",
        institution_id: selectedUser.institution_id || "none"
      })
    }
  }

  const handleSaveUser = async () => {
    try {
      const payload = { ...editUserForm }
      if (payload.institution_id === "none" || payload.institution_id.trim() === "") {
         payload.institution_id = null
      }
      await updateUser(selectedUser.id, payload)
      setIsUserEditMode(false)
      const u = await getUserById(selectedUser.id)
      setSelectedUser(u)
      fetchUsers(userPage)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus user ini?")) {
      try {
        await deleteUser(id)
        if (users.length === 1 && userPage > 1) {
          setUserPage(userPage - 1)
        } else {
          fetchUsers(userPage)
        }
        setIsUserModalOpen(false)
      } catch (error) {
        console.error(error)
      }
    }
  }

  const fetchInstitutions = async (currentPage: number) => {
    try {
      const res = await getInstitutions({ page: currentPage, limit })
      setInstitutions(res.data || [])
      setTotalPages(res.pagination?.total_pages || 1)
    } catch (error) {
      console.error(error)
    }
  }

  const handleOpenDetail = async (id: string) => {
    setIsDetailModalOpen(true)
    setIsDetailLoading(true)
    setSelectedInstitution(null)
    try {
      const inst = await getInstitution(id)
      setSelectedInstitution(inst)
    } catch (error) {
      console.error(error)
    } finally {
      setIsDetailLoading(false)
    }
  }

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
                  {isUserLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="space-y-2">
                             <Skeleton className="h-4 w-[150px]" />
                             <Skeleton className="h-3 w-[100px]" />
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : users && users.length > 0 ? (
                    users.map((u) => (
                      <TableRow key={u.id}>
                         <TableCell>
                            <div className="flex flex-col">
                               <span className="font-medium text-sm">{u.full_name || "Tanpa Nama"}</span>
                               <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                         </TableCell>
                         <TableCell className="capitalize">{u.role || "-"}</TableCell>
                         <TableCell>{u.institutions?.name || "-"}</TableCell>
                         <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => handleOpenUserDetail(u.id)}>
                              <EyeIcon className="size-4 mr-1" />
                              Detail
                            </Button>
                         </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        Belum ada data user.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {userTotalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUserPage((prev) => Math.max(prev - 1, 1))}
                    disabled={userPage === 1 || isUserLoading}
                  >
                    Previous
                  </Button>
                  <div className="text-sm">Halaman {userPage} dari {userTotalPages}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUserPage((prev) => Math.min(prev + 1, userTotalPages))}
                    disabled={userPage === userTotalPages || isUserLoading}
                  >
                    Next
                  </Button>
                </div>
              )}
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
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInstLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : institutions && institutions.length > 0 ? (
                    institutions.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell className="font-medium">{inst.name}</TableCell>
                        <TableCell className="capitalize">{inst.type}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenDetail(inst.id)}>
                            <EyeIcon className="size-4 mr-1" />
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        Belum ada data institusi.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1 || isInstLoading}
                  >
                    Previous
                  </Button>
                  <div className="text-sm">Halaman {page} dari {totalPages}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages || isInstLoading}
                  >
                    Next
                  </Button>
                </div>
              )}
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

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Institusi</DialogTitle>
            <DialogDescription>
              Informasi lengkap terkait institusi yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isDetailLoading ? (
               <div className="space-y-3">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
               </div>
            ) : selectedInstitution ? (
               <div className="grid gap-2 text-sm">
                 <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                   <div className="font-semibold text-muted-foreground">ID Institusi</div>
                   <div className="col-span-2 font-mono text-xs break-all">{selectedInstitution.id}</div>
                 </div>
                 <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                   <div className="font-semibold text-muted-foreground">Nama</div>
                   <div className="col-span-2 font-medium">{selectedInstitution.name}</div>
                 </div>
                 <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                   <div className="font-semibold text-muted-foreground">Tipe</div>
                   <div className="col-span-2 capitalize">{selectedInstitution.type}</div>
                 </div>
                 <div className="grid grid-cols-3 gap-4 pb-2 pt-2">
                   <div className="font-semibold text-muted-foreground">Dibuat Pada</div>
                   <div className="col-span-2">{new Date(selectedInstitution.created_at).toLocaleString()}</div>
                 </div>
               </div>
            ) : (
               <div className="text-center text-muted-foreground py-4">Gagal memuat detail institusi.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Pengguna</DialogTitle>
            <DialogDescription>
              Informasi lengkap terkait pengguna yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isUserDetailLoading ? (
               <div className="space-y-3">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
               </div>
            ) : selectedUser ? (
               <div className="grid gap-2 text-sm">
                 <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                   <div className="font-semibold text-muted-foreground">ID Profil</div>
                   <div className="col-span-2 font-mono text-xs break-all">{selectedUser.id}</div>
                 </div>
                 
                 {isUserEditMode ? (
                    <>
                       <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2 items-center">
                         <Label className="font-semibold text-muted-foreground">Nama</Label>
                         <div className="col-span-2">
                           <Input 
                             value={editUserForm.full_name} 
                             onChange={(e) => setEditUserForm({...editUserForm, full_name: e.target.value})} 
                           />
                         </div>
                       </div>
                       <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2 items-center">
                         <Label className="font-semibold text-muted-foreground">Role</Label>
                         <div className="col-span-2">
                           <Select 
                              value={editUserForm.role}
                              onValueChange={(val) => setEditUserForm({...editUserForm, role: val})}
                           >
                             <SelectTrigger>
                               <SelectValue placeholder="Pilih role" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="admin">Admin</SelectItem>
                               <SelectItem value="hospital_staff">Hospital Staff</SelectItem>
                               <SelectItem value="insurance_reviewer">Insurance Reviewer</SelectItem>
                               <SelectItem value="patient">Patient</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <div className="grid grid-cols-3 gap-4 pb-2 pt-2 items-center">
                         <Label className="font-semibold text-muted-foreground">ID Institusi</Label>
                         <div className="col-span-2">
                           <Input 
                             placeholder="Kosongkan jika tidak ada"
                             value={editUserForm.institution_id === "none" ? "" : editUserForm.institution_id} 
                             onChange={(e) => setEditUserForm({...editUserForm, institution_id: e.target.value || "none"})} 
                           />
                         </div>
                       </div>
                    </>
                 ) : (
                    <>
                       <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                         <div className="font-semibold text-muted-foreground">Nama</div>
                         <div className="col-span-2 font-medium">{selectedUser.full_name || "-"}</div>
                       </div>
                       <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                         <div className="font-semibold text-muted-foreground">Email</div>
                         <div className="col-span-2">{selectedUser.email}</div>
                       </div>
                       <div className="grid grid-cols-3 gap-4 border-b pb-2 pt-2">
                         <div className="font-semibold text-muted-foreground">Role</div>
                         <div className="col-span-2 capitalize">{selectedUser.role}</div>
                       </div>
                       <div className="grid grid-cols-3 gap-4 pb-2 pt-2">
                         <div className="font-semibold text-muted-foreground">Institusi</div>
                         <div className="col-span-2">{selectedUser.institutions?.name || (selectedUser.institution_id ? selectedUser.institution_id : "Tidak ada instansi")}</div>
                       </div>
                    </>
                 )}
               </div>
            ) : (
               <div className="text-center text-muted-foreground py-4">Gagal memuat detail pengguna.</div>
            )}
          </div>
          <DialogFooter className="flex items-center sm:justify-between w-full mt-4 flex-row">
               {selectedUser && !isUserDetailLoading && (
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(selectedUser.id)}>Hapus User</Button>
               )}
               <div className="flex gap-2 ml-auto">
                  {isUserEditMode ? (
                     <>
                        <Button variant="ghost" size="sm" onClick={handleEditUserToggle}>Batal</Button>
                        <Button size="sm" onClick={handleSaveUser}>Simpan</Button>
                     </>
                  ) : (
                     selectedUser && !isUserDetailLoading && (
                        <Button size="sm" onClick={handleEditUserToggle}>Edit Data</Button>
                     )
                  )}
               </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { type Sucursal } from "../page";
import { getUsuariosBySucursal, type UsuarioSucursal } from "../_actions/get-usuarios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Eye, Search, MapPin, Server, Users, Tag } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SucursalesClientProps {
  data: Sucursal[];
}

export default function SucursalesClient({ data }: SucursalesClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSucursal, setSelectedSucursal] = useState<Sucursal | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSucursal[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  const fetchUsuarios = useCallback(async (idSucursal: number) => {
    setLoadingUsuarios(true);
    setUsuarios([]);
    const result = await getUsuariosBySucursal(idSucursal);
    if (result.success) {
      setUsuarios(result.data);
    }
    setLoadingUsuarios(false);
  }, []);

  useEffect(() => {
    if (selectedSucursal) {
      fetchUsuarios(selectedSucursal.id_sucursal);
    } else {
      setUsuarios([]);
    }
  }, [selectedSucursal, fetchUsuarios]);

  const filteredData = data.filter((sucursal) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      sucursal.nombre_sucursal.toLowerCase().includes(searchLower) ||
      (sucursal.municipio_raw && sucursal.municipio_raw.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Buscador */}
      <div className="flex items-center relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filtrar por Nombre o Municipio..."
          className="pl-9 bg-background"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabla simplificada */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[100px] font-semibold">ID</TableHead>
              <TableHead className="font-semibold">Nombre de Sucursal</TableHead>
              <TableHead className="font-semibold">Localidad</TableHead>
              <TableHead className="text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="h-6 w-6 opacity-50" />
                    <span>No se encontraron resultados para tu búsqueda.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((sucursal) => (
                <TableRow key={sucursal.id_sucursal} className="group transition-colors">
                  <TableCell className="font-medium text-muted-foreground">
                    #{sucursal.id_sucursal}
                  </TableCell>
                  <TableCell className="font-medium">{sucursal.nombre_sucursal}</TableCell>
                  <TableCell>{sucursal.localidad_raw || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedSucursal(sucursal)}
                      title="Ver detalles"
                      className="transition-colors hover:bg-muted"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de detalles */}
      <Dialog open={!!selectedSucursal} onOpenChange={(open) => !open && setSelectedSucursal(null)}>
        <DialogContent className="sm:max-w-[500px] gap-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              {selectedSucursal?.nombre_sucursal}
            </DialogTitle>

          </DialogHeader>

          <div className="grid gap-4">
            {/* Alias */}
            <div className="flex flex-col gap-2 rounded-xl border p-4 bg-card shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Tag className="h-4 w-4 text-primary" />
                Alias
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedSucursal?.alias_sucursal || "Sin alias registrado"}
              </p>
            </div>

            {/* Ubicación Completa */}
            <div className="flex flex-col gap-2 rounded-xl border p-4 bg-card shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Ubicación Completa
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {selectedSucursal?.direccion_raw || "Dirección no disponible"}
              </p>
              {selectedSucursal?.localidad_raw && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Localidad:</span> {selectedSucursal.localidad_raw}
                </p>
              )}
              {selectedSucursal?.municipio_raw && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Municipio:</span> {selectedSucursal.municipio_raw}
                </p>
              )}
            </div>

            {/* Resumen de Acceso con listado de usuarios */}
            <div className="flex flex-col gap-3 rounded-xl border p-4 bg-card shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Resumen de Acceso
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={selectedSucursal?.total_usuarios ? "default" : "secondary"}
                  className={!selectedSucursal?.total_usuarios ? "bg-muted text-muted-foreground" : ""}
                >
                  {selectedSucursal?.total_usuarios || 0}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedSucursal?.total_usuarios === 1
                    ? "Usuario con acceso vigente"
                    : "Usuarios con acceso vigente"}
                </span>
              </div>

              {/* Lista de usuarios */}
              {loadingUsuarios ? (
                <div className="flex flex-col gap-2 mt-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-36 rounded-full" />
                  ))}
                </div>
              ) : usuarios.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {usuarios.map((u, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal">
                      {u.nombre_completo}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/70 italic mt-1">
                  No hay usuarios asignados a esta sede.
                </p>
              )}
            </div>

            {/* Información del Sistema */}
            <div className="flex flex-col gap-2 rounded-xl border p-4 bg-card shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Server className="h-4 w-4 text-primary" />
                Información del Sistema
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">Última carga ETL:</span>{" "}
                {selectedSucursal?.fecha_carga_etl
                  ? format(new Date(selectedSucursal.fecha_carga_etl), "dd 'de' MMMM, yyyy - HH:mm", { locale: es })
                  : "Fecha no disponible"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, FileCode2, FolderOpen, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const documents = [
  { name: "Plan_Tesis_AG.pdf", type: "pdf", size: "2.3 MB", modified: "Hace 2 horas" },
  { name: "Capitulo_1_Borrador.docx", type: "word", size: "845 KB", modified: "Hace 1 día" },
  { name: "Observaciones_Revisor_1.pdf", type: "pdf", size: "312 KB", modified: "Hace 3 días" },
  { name: "Bibliografia.docx", type: "word", size: "120 KB", modified: "Hace 1 semana" },
  { name: "Acta_Aprobacion.pdf", type: "pdf", size: "1.1 MB", modified: "Hace 1 mes" },
]

const IconMap = {
  pdf: <FileText className="h-6 w-6 text-red-500" />,
  word: <FileCode2 className="h-6 w-6 text-blue-500" />,
}

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestor de Documentos</CardTitle>
          <CardDescription>
            Busque, visualice y gestione todos los documentos relacionados con las tesis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar documentos..." className="pl-10" />
            </div>
            <Button>Buscar</Button>
          </div>

          <div className="border rounded-lg">
            <ul className="divide-y">
              {documents.map((doc, index) => (
                <li key={index} className="flex items-center justify-between p-4 hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    {IconMap[doc.type as keyof typeof IconMap]}
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm text-muted-foreground">{doc.size}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{doc.modified}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-center items-center h-64 border-2 border-dashed rounded-lg">
        <div className="text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-12 w-12" />
          <p className="mt-4">Página de gestión de documentos en construcción.</p>
        </div>
      </div>
    </div>
  )
}

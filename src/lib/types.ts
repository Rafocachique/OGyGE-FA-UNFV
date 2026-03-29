

export type Notification = {
  id?: string;
  userId: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: any;
};

export enum RevisionStatus {
  RevisionPendiente = "REVISION PENDIENTE",
  EnProceso = "EN PROCESO",
  PorVencer = "POR VENCER",
  APROBADO = "APROBADO",
  Desaprobado = "DESAPROBADO",
  Vencido = "VENCIDO",
}

export type ThesisStatus = "EN REVISION" | "LISTO PARA ASESOR" | "EN ASESORIA" | "CULMINADO" | "DESAPROBADO" | "VENCIDO" | "ARCHIVADO";

export type UserRole = 
  | "admin" 
  | "decano" 
  | "alumno" 
  | "docente" 
  | "docente_revisor" 
  | "docente_asesor" 
  | "docente_supervisor_revisores" 
  | "docente_supervisor_asesores"
  | "docente_supervisor_turnitin"
  | "jurado";

export type DocenteResponsabilidad = 
  | "docente_revisor"
  | "docente_asesor"
  | "docente_supervisor_revisores"
  | "docente_supervisor_asesores"
  | "docente_supervisor_turnitin"
  | "jurado";

export type User = {
    uid: string;
    dni?: string;
    nombre: string;
    apellidos: string;
    correo: string;
    telefono?: string;
    escuela?: string;
    roles: UserRole[];
    activo?: boolean;
    creadoEn?: any;
    actualizadoEn?: any;
    lastLogin?: any;
    supervisorId?: string;
}

export type AppUser = User;

export type UserAction = {
    id: string;
    userId: string;
    type: 'key_action' | 'active_heartbeat';
    action: string;
    details?: string;
    timestamp: any;
};

export type Docente = {
  id: string; // Firestore document ID
  uid: string; // Same as id
  dni?: string;
  nombre: string;
  apellidos: string;
  correo: string; 
  telefono?: string;
  escuela?: string;
  responsabilidades: DocenteResponsabilidad[];
  creadoEn: any;
  actualizadoEn?: any;
}

export type Student = {
    id: string; // Firestore document ID
    userId?: string; // Firebase Auth UID, optional
    supervisorId?: string | null; // UID of the supervisor who created the student
    apellidosNombres: string;
    temaBachiller: string;
    especialidad: string;
    correo?: string | null; // Correo de contacto, puede ser el mismo del usuario
    planActivoId?: string;
    creadoEn: any; // serverTimestamp
    actualizadoEn?: any; // serverTimestamp
    codigo: string; // Student code
    estadoGeneral?: string;
    avatarUrl?: string;
    supervisorRevisoresId?: string | null; // Pre-assigned supervisor
    fechaExpediente?: string | null; // Pre-assigned submission date
}

export type ThesisPlanObservation = {
    id: string;
    // Observacion del docente
    oficioInforme?: string;
    fechaInforme?: any;
    oficioNotificacion?: string;
    fechaNotificacion?: any;
    description?: string;
    informeUrl?: string;
    // Levantamiento del Alumno
    levantamientoDescription?: string;
    fechaLevantamiento?: any;
    oficioNotificacionLevantamiento?: string;
    fechaNotificacionLevantamiento?: any;
    levantamientoUrl?: string;
}

export type MonthlyHistory = {
  month: number;
  year: number;
  etapaActual?: string;
  observaciones?: string;
  apaAprobado?: boolean;
  turnitin1?: {
    fecha: any;
    porcentaje: number | null;
    estado: 'PENDIENTE' | 'APROBado' | 'DESAPROBADO';
  };
  turnitin2?: {
    fecha: any;
    porcentaje: number | null;
    estado: 'PENDIENTE' | 'APROBADO' | 'DESAPROBADO';
  };
  asistencia: boolean;
};


export type ThesisPlan = {
  id: string;
  titulo: string;
  estudiante: Pick<Student, 'codigo' | 'apellidosNombres' | 'especialidad' | 'temaBachiller' | 'avatarUrl'>;
  
  // Review phase
  supervisorRevisoresId?: string;
  docenteRevisor1Id?: string;
  docenteRevisor2Id?: string;

  notificacionAdmin?: {
    comentario: string;
    fecha: any;
    activa: boolean;
  };

  fechaInicioRevision?: any; // Timestamp
  vencimientoRevision?: any; // Timestamp
  diasRestantesRevision?: number;
  
  revisor1?: {
    id: string;
    nombre: string;
    oficioDesignacion?: string;
    estado: RevisionStatus;
    fechaAsignacion?: any;
    fechaAprobado?: any; // Timestamp
    fechaDesaprobado?: any; // Timestamp
    motivoDesaprobado?: string;
    observaciones?: ThesisPlanObservation[];
  };
  revisor2?: {
    id: string;
    nombre: string;
    oficioDesignacion?: string;
    estado: RevisionStatus;
    fechaAsignacion?: any;
    fechaAprobado?: any; // Timestamp
    fechaDesaprobado?: any; // Timestamp
    motivoDesaprobado?: string;
    observaciones?: ThesisPlanObservation[];
  };
  
  // Advisory phase
  asesorId?: string;
  supervisorAsesoresId?: string;
  modalidad?: "Tesis" | "Suficiencia Profesional";
  resolucionDecanalAsesoria?: string;
  oficioAsesoria?: string;
  fechaAsignacion?: any;
  progress?: number; 
  etapaActual?: string;
  observaciones?: string;
  diasRestantesAsesoria?: number;
  fechaVencimientoAsesoria?: any;
  asistencias?: any[];
  historialMensual?: MonthlyHistory[];


  // Final reviews
  apaAprobado?: boolean;
  listoParaTurnitin?: boolean;
  turnitinSupervisorId?: string;

  turnitinApaObservado?: boolean;
  turnitinSupervisorComentario?: string;
  turnitinOficioNotificacionAlumno?: string;
  turnitinFechaNotificacionAlumno?: any;
  turnitinOficioNotificacionDocente?: string;
  turnitinFechaNotificacionDocente?: any;

  turnitin1?: {
    fecha: any;
    porcentaje: number | null;
    estado: 'PENDIENTE' | 'APROBADO' | 'DESAPROBADO';
  };
  turnitin2?: {
    fecha: any;
    porcentaje: number | null;
    estado: 'PENDIENTE' | 'APROBADO' | 'DESAPROBADO';
  };

  ampliacion?: {
    activa: boolean;
    fechaSolicitud?: any;
    fechaNuevoVencimiento?: any; // Timestamp
    motivo: string;
  };
  
  archivo?: {
    archivado: boolean;
    fecha?: any;
    motivo?: string;
  };

  // Global status
  estadoGlobal: ThesisStatus;
  listoParaAsignacionAsesor: boolean;

  // Timestamps
  submissionDate: string; 
  creadoEn: any;
  actualizadoEn?: any;
  fechaAprobacionAsesoria?: any;
};

export type Assignment = {
    id: string; // Corresponds to ThesisPlan ID
    studentId: string;
    studentName: string;
    assignmentType: 'revisores' | 'asesor' | 'turnitin';
    date: string;
    revisor1?: string;
    revisor2?: string;
    supervisorRevisores?: string;
    asesor?: string;
    supervisorAsesores?: string;
    turnitinSupervisor?: string;
    modalidad?: "Tesis" | "Suficiencia Profesional";
  };

    

    

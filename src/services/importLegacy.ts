import { normalizar } from '../store/database'
import type { BancoEmbrioGestor } from '../types/domain'

export async function importarBackup(file: File): Promise<BancoEmbrioGestor> {
  const texto = await file.text()
  const bruto = JSON.parse(texto)
  const banco = bruto?.formato === 'EmbrioGestorBackup' && bruto?.banco
    ? bruto.banco
    : bruto

  return normalizar(banco)
}

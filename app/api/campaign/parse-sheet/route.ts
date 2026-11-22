import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { prisma } from '@/src/lib/prisma';
import { normalizeBrPhone, filterByDdd } from '@/src/lib/phone';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rows: Record<string, any>[] = [];
    let nameColumn = '';
    let phoneColumns: string[] = [];
    let extraColumns: string[] = [];
    let clientId: string | null = null;
    let allowedDdds: string | null = null;
    let dedupDays = 30;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      nameColumn = (formData.get('nameColumn') as string) || '';
      phoneColumns = JSON.parse((formData.get('phoneColumns') as string) || '[]');
      extraColumns = JSON.parse((formData.get('extraColumns') as string) || '[]');
      clientId = (formData.get('clientId') as string) || null;
      allowedDdds = (formData.get('allowedDdds') as string) || null;
      dedupDays = Number(formData.get('dedupDays') || 30);

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        const text = buffer.toString('utf-8');
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = parsed.data as Record<string, any>[];
      } else {
        // Excel (.xlsx, .xls)
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
      }
    } else {
      // JSON body
      const body = await req.json();
      rows = body.rows || [];
      nameColumn = body.nameColumn || '';
      phoneColumns = body.phoneColumns || [];
      extraColumns = body.extraColumns || [];
      clientId = body.clientId || null;
      allowedDdds = body.allowedDdds || null;
      dedupDays = Number(body.dedupDays || 30);
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'A planilha enviada está vazia.' }, { status: 400 });
    }

    // Identifica cabeçalhos disponíveis
    const headers = Object.keys(rows[0] || {});

    // Se as colunas de telefone não foram especificadas, tenta auto-detectar
    if (phoneColumns.length === 0) {
      phoneColumns = headers.filter((h) => {
        const lower = h.toLowerCase().trim();
        return (
          lower.includes('tel') ||
          lower.includes('cel') ||
          lower.includes('fone') ||
          lower.includes('phone') ||
          lower.includes('numero') ||
          lower.includes('número') ||
          lower.includes('whatsapp')
        );
      });
      // Se não achou por nome, usa a primeira coluna
      if (phoneColumns.length === 0 && headers.length > 0) {
        phoneColumns = [headers[0]];
      }
    }

    // Auto-detecta coluna de nome se não fornecida
    if (!nameColumn) {
      const detectedName = headers.find((h) => {
        const lower = h.toLowerCase().trim();
        return lower === 'nome' || lower === 'name' || lower.includes('cliente') || lower.includes('contato');
      });
      if (detectedName) nameColumn = detectedName;
    }

    // Busca histórico de números disparados nos últimos X dias para este cliente (Deduplicação)
    const dispatchedPhonesSet = new Set<string>();
    if (clientId && dedupDays > 0) {
      const cutoffDate = new Date(Date.now() - dedupDays * 24 * 60 * 60 * 1000);
      try {
        const recentContacts: any[] = await prisma.contact.findMany({
          where: {
            clientId,
            status: 'sent',
            sentAt: { gte: cutoffDate },
          } as any,
          select: { normalizedPhone: true } as any,
        });
        recentContacts.forEach((c) => {
          if (c.normalizedPhone) dispatchedPhonesSet.add(c.normalizedPhone);
        });
      } catch (err: any) {
        console.warn('[Parse Sheet] Aviso ao consultar histórico de deduplicação:', err.message);
      }
    }

    // Processamento e Higienização das Linhas
    let totalNumbersFound = 0;
    let discardedInvalid = 0;
    let discardedDdd = 0;
    let discardedDuplicate = 0;

    interface ProcessedContactItem {
      rawNumber: string;
      normalizedPhone: string;
      name: string;
      contactGroupKey: string;
      variables: Record<string, any>;
    }

    const validContacts: ProcessedContactItem[] = [];
    const seenInThisSheet = new Set<string>();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const contactGroupKey = `grp_${rowIndex}_${Date.now().toString(36)}`;
      const contactName = nameColumn && row[nameColumn] ? String(row[nameColumn]).trim() : '';

      // Extrai colunas adicionais para variáveis da copy
      const variables: Record<string, any> = {};
      extraColumns.forEach((col) => {
        if (row[col] !== undefined && row[col] !== null) {
          variables[col] = String(row[col]).trim();
        }
      });

      // Explode os números de telefone mapeados
      for (const pCol of phoneColumns) {
        const rawVal = row[pCol];
        if (!rawVal) continue;

        totalNumbersFound++;
        const norm = normalizeBrPhone(rawVal);

        if (!norm.isValid) {
          discardedInvalid++;
          continue;
        }

        // Filtro de DDD
        if (!filterByDdd(norm.ddd, allowedDdds)) {
          discardedDdd++;
          continue;
        }

        // Deduplicação pelo histórico do cliente
        if (dispatchedPhonesSet.has(norm.normalized)) {
          discardedDuplicate++;
          continue;
        }

        // Deduplicação intra-planilha (não disparar duas vezes para o mesmo número na mesma campanha)
        if (seenInThisSheet.has(norm.normalized)) {
          continue;
        }
        seenInThisSheet.add(norm.normalized);

        validContacts.push({
          rawNumber: norm.raw,
          normalizedPhone: norm.normalized,
          name: contactName,
          contactGroupKey,
          variables,
        });
      }
    }

    // Amostra real dos 3 primeiros contatos para pré-visualização na UI
    const preview = validContacts.slice(0, 3).map((c) => ({
      name: c.name,
      normalizedPhone: c.normalizedPhone,
      variables: c.variables,
    }));

    return NextResponse.json({
      success: true,
      headers,
      selected: {
        nameColumn,
        phoneColumns,
        extraColumns,
      },
      summary: {
        totalRows: rows.length,
        totalNumbers: totalNumbersFound,
        validNumbers: validContacts.length,
        discardedInvalid,
        discardedDdd,
        discardedDuplicate,
      },
      preview,
      contacts: validContacts,
    });
  } catch (error: any) {
    console.error('[Parse Sheet Error]:', error);
    return NextResponse.json({ error: error.message || 'Falha ao processar planilha' }, { status: 500 });
  }
}

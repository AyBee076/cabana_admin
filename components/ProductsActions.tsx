'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PencilIcon, TrashIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import ProductFormDialog from '@/components/AddProduct' // adjust path/name

export default function ProductActions({ productId, isDeleted }: { productId: string; isDeleted: boolean }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  const toggleDeleted = async () => { /* unchanged */ }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setEditOpen(true)}
        className="text-blue-600 hover:text-blue-800"
        title="Edit"
      >
        <PencilIcon size={18} />
      </button>

      <button onClick={toggleDeleted} /* ...unchanged */>
        {isDeleted ? <ArrowCounterClockwiseIcon size={18} /> : <TrashIcon size={18} />}
      </button>

      {editOpen && (
        <ProductFormDialog
          productId={productId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}
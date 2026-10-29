import { useEffect, useState, useCallback, useRef } from 'react'
import { getCharacter, updateCharacter, updateSkill, createSkill, deleteSkill, improveSkills, createEquipmentItem, updateEquipmentItem, deleteEquipmentItem, createMentalScar, deleteMentalScar } from '../api/characters.js'
import useDebounce from './useDebounce.js'

// HP and MP max follow from the characteristics — recomputed locally so the
// sheet updates before the debounced save comes back
export function derivedFromChar(ch) {
  return {
    hp_max: Math.max(1, Math.floor((ch.con_stat + ch.siz_stat) / 10)),
    mp_max: Math.max(1, Math.floor(ch.pow_stat / 5)),
  }
}

// Everything a character sheet does, independent of how it looks — shared by
// the classic sheet and the bureau dossier.
export default function useCharacterSheet(id, { onNotFound } = {}) {
  const [char, setChar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('') // 'saving' | 'saved' | ''
  const pendingRef = useRef({})
  const [improving, setImproving] = useState(false)
  const [improvementResults, setImprovementResults] = useState(null)
  const [improveError, setImproveError] = useState('')
  const [equipment, setEquipment] = useState([])
  const [mentalScars, setMentalScars] = useState([])

  const onNotFoundRef = useRef(onNotFound)
  useEffect(() => { onNotFoundRef.current = onNotFound }, [onNotFound])

  // Load character
  useEffect(() => {
    getCharacter(id)
      .then((res) => {
        setChar(res.data)
        setEquipment(res.data.equipment ?? [])
        setMentalScars(res.data.mental_scars ?? [])
      })
      .catch(() => onNotFoundRef.current?.())
      .finally(() => setLoading(false))
  }, [id])

  // Debounced auto-save
  const doSave = useCallback(
    async (patch) => {
      setSaveStatus('saving')
      try {
        const res = await updateCharacter(id, patch)
        setChar(res.data)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
      } catch {
        setSaveStatus('')
      }
    },
    [id],
  )

  const debouncedSave = useDebounce(doSave, 800)

  // Field change handler — merges into state and schedules save
  const handleChange = (field, value) => {
    setChar((prev) => {
      const next = { ...prev, [field]: value }
      // Derive frontend hp/mp max for display
      if (['con_stat', 'siz_stat', 'pow_stat'].includes(field)) {
        const derived = derivedFromChar(next)
        Object.assign(next, derived)
      }
      pendingRef.current = { ...pendingRef.current, [field]: value }
      debouncedSave(pendingRef.current)
      return next
    })
  }

  const uploadPortrait = async (file) => {
    setSaveStatus('saving')
    try {
      const res = await updateCharacter(id, { portrait_image: file })
      setChar((prev) => ({ ...prev, portrait_image: res.data.portrait_image }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch {
      setSaveStatus('')
    }
  }

  const handleSkillChange = (updatedSkill) => {
    setChar((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.id === updatedSkill.id ? updatedSkill : s)),
    }))
    updateSkill(id, updatedSkill.id, {
      current_value: updatedSkill.current_value,
      checked: updatedSkill.checked,
    }).catch(() => {})
  }

  // Resolves to true once the skill is on the sheet
  const addSkill = async (name) => {
    if (!name.trim()) return false
    try {
      const res = await createSkill(id, { name: name.trim() })
      setChar((prev) => ({ ...prev, skills: [...(prev.skills ?? []), res.data] }))
      return true
    } catch {
      return false
    }
  }

  const handleDeleteSkill = (skillId) => {
    setChar((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== skillId) }))
    deleteSkill(id, skillId).catch(() => {})
  }

  const handleImproveSkills = async () => {
    setImproving(true)
    setImproveError('')
    try {
      const res = await improveSkills(id)
      const results = res.data.results
      setChar((prev) => ({
        ...prev,
        skills: prev.skills.map((s) => {
          const r = results.find((r) => r.skill_id === s.id)
          return r ? { ...s, current_value: r.new_value, checked: false } : s
        }),
      }))
      setImprovementResults(results)
    } catch (err) {
      setImproveError(err?.response?.data?.error ?? 'Помилка підвищення навичок.')
    } finally {
      setImproving(false)
    }
  }

  const addItem = async (name, notes) => {
    if (!name.trim()) return false
    try {
      const res = await createEquipmentItem(id, {
        name: name.trim(),
        notes: notes.trim(),
        order: equipment.length,
      })
      setEquipment((prev) => [...prev, res.data])
      return true
    } catch {
      return false
    }
  }

  const handleDeleteItem = async (itemId) => {
    setEquipment((prev) => prev.filter((i) => i.id !== itemId))
    deleteEquipmentItem(id, itemId).catch(() => {})
  }

  const handleUpdateItemNotes = (itemId, notes) => {
    setEquipment((prev) => prev.map((i) => i.id === itemId ? { ...i, notes } : i))
    updateEquipmentItem(id, itemId, { notes }).catch(() => {})
  }

  const addScar = async (name, scarType) => {
    if (!name.trim()) return false
    try {
      const res = await createMentalScar(id, { name: name.trim(), scar_type: scarType })
      setMentalScars((prev) => [...prev, res.data])
      return true
    } catch {
      return false
    }
  }

  const handleDeleteScar = (scarId) => {
    setMentalScars((prev) => prev.filter((s) => s.id !== scarId))
    deleteMentalScar(id, scarId).catch(() => {})
  }

  return {
    char, loading, saveStatus,
    handleChange, uploadPortrait,
    handleSkillChange, addSkill, handleDeleteSkill,
    improving, improvementResults, setImprovementResults, improveError, handleImproveSkills,
    equipment, addItem, handleDeleteItem, handleUpdateItemNotes,
    mentalScars, addScar, handleDeleteScar,
  }
}

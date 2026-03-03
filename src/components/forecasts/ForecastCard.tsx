  useEffect(() => {
    if (!showAdminMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAdminMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAdminMenu])

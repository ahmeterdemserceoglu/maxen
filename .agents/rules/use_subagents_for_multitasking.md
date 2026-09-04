# Çoklu Görevlerde (Multi-Tasking) Alt Ajanları ve Arka Plan Görevlerini Kullanma

1. **Paralel Çalıştırma:** Eğer kullanıcının talebi birden fazla bağımsız ve zaman alan işlem içeriyorsa, bu işlemleri sırayla (senkron) yapmak yerine paralel olarak yürütün.
2. **Subagents Kullanımı:** Uygun olan yerlerde (örneğin `browser_subagent` veya sisteme tanımlı diğer alt ajan çağrıları aracılığıyla) görevleri alt ajanlara devrederek ana ajanın kilitlenmesini önleyin.
3. **Arka Plan Görevleri (Background Tasks):** Terminal komutları çalıştırılırken (özellikle bağımsız testler, build alma işlemleri veya log izleme), işlemi arka plana gönderip eşzamanlı olarak diğer kodlama görevlerine devam edin.
4. **Zaman Yönetimi:** İşlemlerin sonuçlarını beklerken boşta kalmamak adına yapılabilecek diğer işlemleri aradan çıkarın.

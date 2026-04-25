// Reviews batch 6 — final 77 reviews → PT/DE/ES/FR
import pg from "pg";
const { Client } = pg;

const REV = [
  {
    id: "8c7ba9e2-51a9-43ac-ab63-78e638125509",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Experiência incrível a colaborar com o André no pedido de casamento surpresa do meu irmão e da noiva. Foi muito profissional, flexível, com imensas sugestões e disposto a mudar o plano consoante o tempo. A sua personalidade divertida e a sua simpatia tornaram a experiência ainda mais bonita. As fotos estão fantásticas e foram entregues em 24 horas. Obrigada, André! 🫶",
      de: "Eine fantastische Erfahrung mit André bei der Überraschungsverlobung meines Bruders und seiner Verlobten. Er war sehr professionell, flexibel, hat viele Vorschläge gemacht und den Plan je nach Wetter angepasst. Seine fröhliche Persönlichkeit und seine herzliche Art haben das Erlebnis noch schöner gemacht. Die Fotos sind großartig geworden, und er hat sie innerhalb von 24 Stunden geliefert. Danke, André! 🫶",
      es: "Una experiencia increíble colaborando con André para la pedida sorpresa de mi hermano y su prometida. Fue muy profesional, flexible, con muchísimas sugerencias y dispuesto a cambiar el plan en función del tiempo. Su personalidad divertida y su actitud amable hicieron que la experiencia fuera aún más bonita. Las fotos quedaron increíbles y las entregó en 24 horas. ¡Gracias, André! 🫶",
      fr: "Une expérience incroyable en collaborant avec André pour la demande en mariage surprise de mon frère et de sa fiancée. Il a été très professionnel, flexible, avec plein de suggestions et prêt à modifier le plan en fonction de la météo. Sa personnalité joyeuse et sa gentillesse ont rendu l'expérience encore plus belle. Les photos sont magnifiques et il les a livrées en 24 heures. Merci, André ! 🫶",
    },
  },
  {
    id: "e7520e51-c912-4b5a-a3d3-08dd148e5265",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Escolhi o André para o meu pedido de casamento surpresa e não podia estar mais feliz! Foi um profissional incrível a manter-se discreto para não estragar a surpresa, e mesmo assim conseguiu captar todas as emoções na perfeição. As fotos estão deslumbrantes e foi muito prestável durante a fase de planeamento. Se estás nervoso por fazer um pedido, o André é a pessoa certa!",
      de: "Ich habe André für meinen Überraschungsantrag gewählt und könnte nicht glücklicher sein! Er war ein absoluter Profi darin, sich unbemerkt im Hintergrund zu halten, damit die Überraschung nicht auffliegt, und hat trotzdem jede einzelne Emotion perfekt eingefangen. Die Fotos sind atemberaubend, und er war in der Planungsphase super hilfreich. Wenn du nervös bist, einen Antrag zu machen — André ist dein Mann!",
      es: "Elegí a André para mi pedida sorpresa y no podría estar más contento. Fue un crack manteniéndose discreto para no estropear la sorpresa y aun así consiguió captar a la perfección cada emoción. Las fotos quedaron impresionantes y fue muy atento durante la fase de planificación. Si estás nervioso por preparar una pedida, André es tu chico.",
      fr: "J'ai choisi André pour ma demande surprise et je ne pourrais pas être plus heureux ! Il a été d'un professionnalisme total pour rester dans l'ombre afin de ne pas gâcher la surprise, et a tout de même su capturer chaque émotion à la perfection. Les photos sont magnifiques et il a été très utile pendant la phase de planification. Si tu es stressé à l'idée d'organiser une demande, André est l'homme de la situation !",
    },
  },
  {
    id: "ee1e5a9b-2583-4154-b7da-7a3711e470cf",
    title: {
      pt: "Muito mais do que apenas uma fotógrafa!",
      de: "Viel mehr als nur eine Fotografin!",
      es: "¡Mucho más que solo una fotógrafa!",
      fr: "Bien plus qu'une simple photographe !",
    },
    text: {
      pt: "Queremos deixar um agradecimento muito especial à Débora, que não foi apenas uma fotógrafa no nosso casamento — foi A fotógrafa. Esteve presente em cada momento, sempre atenta, disponível e incrivelmente sensível. Para além do seu talento, ainda nos ajudou a gerir a ansiedade típica do grande dia! O resultado final é simplesmente excelente — superou todas as nossas expectativas — e o feedback foi unânime: todos os convidados elogiaram o profissionalismo e a forma como captou cada detalhe de forma tão natural. Agradecemos do fundo do coração todo o calor, a paciência e o cuidado ao longo do processo, desde o primeiro contacto até ao grande dia. Foi muito mais do que um serviço — foi uma experiência de confiança e proximidade que nunca esqueceremos. Obrigada por fazeres parte da nossa história.",
      de: "Wir möchten Débora einen ganz besonderen Dank aussprechen — sie war nicht nur eine Fotografin auf unserer Hochzeit, sie war DIE Fotografin. Sie war in jedem Moment dabei, immer aufmerksam, erreichbar und unglaublich einfühlsam. Über ihr Talent hinaus hat sie uns auch geholfen, die typische Aufregung des großen Tages zu bewältigen! Das Endergebnis ist einfach hervorragend — es hat all unsere Erwartungen übertroffen — und das Feedback war einstimmig: alle Gäste haben ihre Professionalität und die Art und Weise gelobt, wie sie jedes Detail so natürlich eingefangen hat. Wir danken dir aus tiefstem Herzen für all die Wärme, Geduld und Fürsorge während des gesamten Prozesses, vom ersten Kontakt bis zum großen Tag. Es war viel mehr als nur ein Service — es war eine Erfahrung von Vertrauen und Nähe, die wir nie vergessen werden. Danke, dass du Teil unserer Geschichte warst.",
      es: "Queremos darle un agradecimiento muy especial a Débora, que no fue solo una fotógrafa en nuestra boda — fue LA fotógrafa. Estuvo presente en cada momento, siempre atenta, disponible e increíblemente sensible. Además de su talento, también nos ayudó a manejar la ansiedad típica del gran día. El resultado final es, sencillamente, excelente — superó todas nuestras expectativas — y los comentarios fueron unánimes: todos los invitados elogiaron su profesionalidad y la forma en que captó cada detalle con tanta naturalidad. Te damos las gracias desde el fondo del corazón por todo el cariño, la paciencia y el cuidado durante todo el proceso, desde el primer contacto hasta el gran día. Fue mucho más que un servicio — fue una experiencia de confianza y cercanía que nunca olvidaremos. Gracias por formar parte de nuestra historia.",
      fr: "Nous tenons à remercier tout particulièrement Débora, qui n'a pas été simplement une photographe à notre mariage — elle a été LA photographe. Elle a été présente à chaque moment, toujours attentive, disponible et incroyablement sensible. Au-delà de son talent, elle nous a aussi aidés à gérer l'anxiété qui accompagne le grand jour ! Le résultat final est tout simplement excellent — il a dépassé toutes nos attentes — et les retours ont été unanimes : tous les invités ont salué son professionnalisme et la façon dont elle a capturé chaque détail avec autant de naturel. Nous te remercions du fond du cœur pour toute la chaleur, la patience et l'attention tout au long du processus, du premier contact jusqu'au grand jour. C'était bien plus qu'une prestation — c'était une expérience de confiance et de proximité que nous n'oublierons jamais. Merci de faire partie de notre histoire.",
    },
  },
  {
    id: "f9182fe5-a6c4-4489-b3c0-9f9e833922c2",
    title: {
      pt: "Fotos lindas!",
      de: "Wunderschöne Fotos!",
      es: "¡Fotos preciosas!",
      fr: "De magnifiques photos !",
    },
    text: {
      pt: "A Jennifer é extremamente simpática, super profissional e foi elogiada pelos nossos convidados pela sua boa disposição e pelo sorriso constante. A sua criatividade através da arte da fotografia surpreendeu toda a gente que ainda não a conhecia, e para nós, enquanto casal, confirmou que tínhamos feito a melhor escolha possível! Fez-nos sentir muito confortáveis e tirou o máximo partido do espaço lindíssimo e das condições do tempo. Para além disso, sentimos que se adapta muito bem às pessoas que tem à sua frente. As fotos parecem saídas de um livro de contos! As melhores recordações deste dia vão ser, sem dúvida, revividas sempre que voltarmos a olhar para as fotos!",
      de: "Jennifer ist extrem freundlich, hochprofessionell und wurde von unseren Gästen für ihre lockere Art und ihr ständiges Lächeln gelobt. Ihre Kreativität durch die Kunst der Fotografie hat alle überrascht, die sie vorher nicht kannten, und uns als Paar hat sie bestätigt, dass wir die bestmögliche Wahl getroffen hatten! Sie hat uns absolut entspannt sein lassen und die wunderschöne Location und das Wetter optimal genutzt. Außerdem haben wir das Gefühl, dass sie sich hervorragend an die Menschen anpasst, die vor ihrer Linse stehen. Die Fotos sehen aus, als kämen sie aus einem Märchenbuch! Die schönsten Erinnerungen an diesen Tag werden sicher jedes Mal wieder lebendig, wenn wir die Fotos ansehen!",
      es: "Jennifer es extremadamente simpática, súper profesional y nuestros invitados elogiaron su buen humor y su sonrisa constante. Su creatividad a través del arte de la fotografía sorprendió a todos los que no la conocían y, para nosotros como pareja, confirmó que habíamos tomado la mejor decisión posible. Nos hizo sentir muy cómodos y aprovechó al máximo el precioso lugar y las condiciones meteorológicas. Además, sentimos que se adapta muy bien a las personas que tiene delante. ¡Las fotos parecen sacadas de un libro de cuentos! Los mejores recuerdos de este día sin duda los reviviremos cada vez que volvamos a ver las fotos.",
      fr: "Jennifer est extrêmement sympathique, hautement professionnelle et nos invités ont salué sa bonne humeur et son sourire permanent. Sa créativité à travers l'art de la photographie a surpris tous ceux qui ne la connaissaient pas, et pour nous, en tant que couple, cela a confirmé que nous avions fait le meilleur choix possible ! Elle nous a mis très à l'aise et a tiré le meilleur du magnifique lieu et des conditions météo. En plus, nous avons senti qu'elle s'adapte très bien aux personnes qu'elle a devant son objectif. Les photos semblent sorties d'un livre de contes ! Les meilleurs souvenirs de cette journée seront sans aucun doute revécus chaque fois que nous reverrons ces photos !",
    },
  },
  {
    id: "a004a153-9f16-42b7-8f32-52fd960776ce",
    title: {
      pt: "Talento, profissionalismo e amizade!",
      de: "Talent, Professionalität und Freundschaft!",
      es: "¡Talento, profesionalidad y amistad!",
      fr: "Talent, professionnalisme et amitié !",
    },
    text: {
      pt: "Escolher a Jennifer como fotógrafa do nosso casamento foi, sem dúvida, a decisão mais fácil de todo o processo. Desde o momento em que vimos o trabalho dela, até à primeira conversa, foi óbvio que íamos formar uma ótima equipa. Não só prestou um excelente serviço fotográfico, como também se tornou alguém de quem realmente gostamos. Apesar de não nos conhecer bem, ofereceu-se para viajar até ao país onde vivemos para a nossa sessão de noivado e captou a nossa vida e os nossos lugares preferidos de forma única. Estamos profundamente gratos por isso! A Jennifer e a sua equipa foram, sem dúvida, a melhor escolha para o nosso casamento. Não temos palavras para descrever a felicidade ao ver a galeria final — ou o quanto a recomendamos pelo seu talento, pela sua amizade e pela forma profundamente humana como vive cada história que fotografa! Obrigada por tudo, Jennifer ♡",
      de: "Jennifer als Fotografin für unsere Hochzeit zu wählen, war ohne Zweifel die einfachste Entscheidung des gesamten Prozesses. Vom Moment, als wir ihre Arbeit gesehen haben, bis zum ersten Gespräch war klar, dass wir ein großartiges Team werden würden. Sie hat nicht nur einen hervorragenden Fotografie-Service geliefert, sondern ist auch ein Mensch geworden, der uns wirklich am Herzen liegt. Obwohl sie uns kaum kannte, bot sie an, in das Land zu reisen, in dem wir leben, um unser Engagement-Shooting zu machen, und hat unser Leben und unsere Lieblingsorte auf einzigartige Weise eingefangen. Dafür sind wir unglaublich dankbar! Jennifer und ihr Team waren ohne Zweifel die beste Wahl für unsere Hochzeit. Wir haben keine Worte, um zu beschreiben, wie glücklich wir waren, als wir die finale Galerie sahen — oder wie sehr wir sie für ihr Talent, ihre Freundschaft und die zutiefst menschliche Art empfehlen, mit der sie jede Geschichte, die sie fotografiert, mitlebt! Danke für alles, Jennifer ♡",
      es: "Elegir a Jennifer como fotógrafa de nuestra boda fue, sin duda, la decisión más fácil de todo el proceso. Desde el momento en que vimos su trabajo, hasta nuestra primera conversación, fue evidente que íbamos a formar un gran equipo. No solo brindó un excelente servicio fotográfico, sino que también se convirtió en alguien a quien queremos de verdad. Aunque no nos conocía mucho, se ofreció a viajar al país donde vivimos para nuestra sesión de pedida y captó nuestra vida y nuestros lugares favoritos de una forma única. ¡Estamos enormemente agradecidos por eso! Jennifer y su equipo fueron, sin duda, la mejor elección para nuestra boda. No tenemos palabras para describir la felicidad al ver la galería final — ni lo mucho que la recomendamos por su talento, su amistad y la forma profundamente humana en la que vive cada historia que fotografía. Gracias por todo, Jennifer ♡",
      fr: "Choisir Jennifer comme photographe pour notre mariage a été, sans aucun doute, la décision la plus facile de tout le processus. Du moment où nous avons vu son travail à notre première conversation, il était évident que nous formerions une super équipe. Non seulement elle a offert un excellent service photographique, mais elle est aussi devenue quelqu'un à qui nous tenons vraiment. Même si elle ne nous connaissait pas bien, elle a proposé de voyager jusqu'au pays où nous vivons pour notre séance de fiançailles et a capturé notre vie et nos lieux préférés d'une manière unique. Nous lui en sommes incroyablement reconnaissants ! Jennifer et son équipe ont été, sans aucun doute, le meilleur choix pour notre mariage. Nous n'avons pas de mots pour décrire le bonheur que nous avons ressenti en voyant la galerie finale — ni à quel point nous la recommandons pour son talent, son amitié et la manière profondément humaine avec laquelle elle vit chaque histoire qu'elle photographie ! Merci pour tout, Jennifer ♡",
    },
  },
  {
    id: "d33cfea8-c99c-480b-b13e-b8b72d048fc6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Vimos as fotos, estão fantásticas! A da capa é simplesmente top. E nem se nota o mosquito de Lisboa na bochecha do Mark. As fotos ficaram muito quentes e acolhedoras — já estamos a escolher quais imprimir. Obrigada por captares a nossa viagem de forma tão linda!",
      de: "Wir haben uns die Fotos angesehen, sie sind großartig! Das Titelbild ist absolute Spitze. Und vom Lissabon-Mücke auf Marks Wange ist nichts zu sehen. Die Aufnahmen sind sehr warm geworden, wir suchen schon aus, welche wir drucken lassen. Danke, dass du unsere Reise auf so wunderschöne Weise eingefangen hast!",
      es: "Vimos las fotos, ¡están geniales! La de la portada es de diez. Y ni rastro del mosquito de Lisboa en la mejilla de Mark. Las fotos quedaron muy cálidas, ya estamos eligiendo cuáles imprimir. ¡Gracias por captar nuestro viaje de una forma tan bonita!",
      fr: "Nous avons regardé les photos, elles sont magnifiques ! Celle de la couverture est top. Et plus aucune trace du moustique lisboète sur la joue de Mark. Les photos sont très chaleureuses, nous sommes déjà en train de choisir lesquelles imprimer. Merci d'avoir si joliment capturé notre voyage !",
    },
  },
  {
    id: "7cb928e3-12a9-47a2-b82c-051089c9bf86",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ohhh raios — ficaram lindíssimas, estou em choque 🧡",
      de: "Ohhh wow — sie sind wunderschön geworden, ich bin sprachlos 🧡",
      es: "Ohhh madre mía — han quedado preciosísimas, estoy en shock 🧡",
      fr: "Ohhh la vache — elles sont magnifiques, je suis sous le choc 🧡",
    },
  },
  {
    id: "17e13ac8-7607-40a6-b232-31053c05598f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Só de pensar nisto, fico com lágrimas de felicidade nos olhos 🥲 Ola, obrigada por uma sessão tão maravilhosa 💙 — vai ficar connosco durante muito tempo… e mal posso esperar para a imprimir e pendurar em casa 🤍💙",
      de: "Allein der Gedanke daran lässt mir Tränen der Freude in die Augen steigen 🥲 Ola, danke für ein so wunderschönes Shooting 💙 — es wird uns noch lange begleiten… und ich kann es kaum erwarten, die Bilder drucken zu lassen und sie zu Hause aufzuhängen 🤍💙",
      es: "Solo de recordarlo se me saltan las lágrimas de felicidad 🥲 Ola, gracias por una sesión tan maravillosa 💙 — nos va a acompañar mucho tiempo... y no veo la hora de imprimirla y colgarla en casa 🤍💙",
      fr: "Rien que d'y repenser, j'en ai les larmes de joie aux yeux 🥲 Ola, merci pour une si merveilleuse séance 💙 — elle nous accompagnera longtemps… et j'ai hâte de la faire imprimer et de l'accrocher à la maison 🤍💙",
    },
  },
  {
    id: "43eadd7c-6581-453b-9067-0876e6bfd74a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Um momento maravilhoso em família com o Denis. Adorámos todos, miúdos e graúdos. O Denis é atento e deixa toda a gente à vontade. E as fotos estão magníficas! 😍 Mais uma vez obrigada por este momento delicioso.",
      de: "Eine wunderbare Zeit mit der Familie mit Denis. Wir haben es alle geliebt, Jung und Alt. Denis ist aufmerksam und lässt jeden entspannen. Und die Fotos sind großartig! 😍 Nochmals vielen Dank für diesen schönen Moment.",
      es: "Un momento maravilloso en familia con Denis. Nos encantó a todos, mayores y pequeños. Denis es atento y pone cómodo a todo el mundo. ¡Y las fotos son magníficas! 😍 Mil gracias de nuevo por este precioso momento.",
      fr: "Un moment merveilleux en famille avec Denis. Nous avons tous adoré, petits et grands. Denis est attentionné et met tout le monde à l'aise. Et les photos sont magnifiques ! 😍 Merci encore pour ce joli moment.",
    },
  },
  {
    id: "8029f47c-0d6d-466d-9143-49d4e62092ea",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Criatividade e excelência jovem. São uma equipa jovem, extremamente criativa, alegre e sempre pronta a adaptar-se aos gostos e desejos do casal. Foram extremamente meticulosos em cada detalhe — desde a qualidade das fotos à iluminação, ao local perfeito para os planos — e estiveram sempre presentes a destacar o amor, a felicidade e a beleza de todo o casamento e dos convidados, com um cuidado especial pelo casal. Recomendo vivamente — para além de profissionais e simpáticos, têm imenso talento para captar a naturalidade dos momentos.",
      de: "Kreativität und junge Exzellenz. Sie sind ein junges, extrem kreatives, fröhliches Team, das immer bereit ist, sich den Wünschen und Vorlieben des Brautpaars anzupassen. Sie waren bei jedem Detail extrem gewissenhaft — von der Bildqualität über die Beleuchtung bis zur perfekten Location für die Aufnahmen — und waren immer da, um die Liebe, die Freude und die Schönheit der gesamten Hochzeit und aller Gäste hervorzuheben, mit besonderer Aufmerksamkeit für das Brautpaar. Ich empfehle sie wärmstens — sie sind nicht nur professionell und freundlich, sondern haben auch ein enormes Talent dafür, die Natürlichkeit der Momente einzufangen.",
      es: "Creatividad y excelencia joven. Son un equipo joven, súper creativo, alegre y siempre dispuesto a adaptarse a los gustos y deseos de la pareja. Fueron extremadamente meticulosos con cada detalle — desde la calidad de las fotos hasta la iluminación o el lugar perfecto para los planos — y estuvieron siempre presentes destacando el amor, la felicidad y la belleza de toda la boda y de todos los invitados, con un cuidado especial hacia los novios. Los recomiendo muchísimo — además de ser profesionales y simpáticos, tienen un enorme talento para captar la naturalidad de los momentos.",
      fr: "Créativité et excellence de la nouvelle génération. C'est une équipe jeune, extrêmement créative, joyeuse, toujours prête à s'adapter aux goûts et aux envies du couple. Ils ont été extrêmement méticuleux sur chaque détail — de la qualité des photos à la lumière, en passant par le lieu parfait pour les clichés — et ont toujours été là pour mettre en valeur l'amour, le bonheur et la beauté de tout le mariage et des invités, avec une attention particulière pour les mariés. Je les recommande vivement — en plus d'être professionnels et sympathiques, ils ont un immense talent pour capter le naturel des moments.",
    },
  },
  {
    id: "52270161-e1b9-486d-9a14-4d6f0538f213",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Equipa excelente! Uma equipa jovem, dinâmica e profissional. Atenta aos detalhes, aos gostos do casal e com uma qualidade de trabalho fantástica. Fotografias elegantes que ainda assim captam a simplicidade, a felicidade e a naturalidade. Adorei mesmo o resultado final.",
      de: "Hervorragendes Team! Ein junges, dynamisches und professionelles Team. Aufmerksam für die Details, für die Wünsche des Brautpaars und mit einer fantastischen Arbeitsqualität. Elegante Fotos, die dennoch Schlichtheit, Glück und Natürlichkeit einfangen. Ich habe das Endergebnis absolut geliebt.",
      es: "¡Equipo excelente! Un equipo joven, dinámico y profesional. Atentos a los detalles, a los gustos de la pareja y con una calidad de trabajo fantástica. Fotografías elegantes que aun así captan la sencillez, la felicidad y la naturalidad. Me encantó el resultado final.",
      fr: "Une équipe excellente ! Une équipe jeune, dynamique et professionnelle. Attentive aux détails, aux goûts du couple et offrant une qualité de travail fantastique. Des photographies élégantes qui réussissent à capturer la simplicité, le bonheur et le naturel. J'ai vraiment adoré le résultat final.",
    },
  },
  {
    id: "bebc60d6-1450-452f-8797-c270aea176e4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratei a equipa para o batizado da minha filha 🤩 Serviço rápido e simpático… sempre muito prestáveis e disponíveis para qualquer dúvida!!! Trabalho entregue muito rapidamente… Recomendo a 100% 👌👌",
      de: "Ich habe das Team für die Taufe meiner Tochter engagiert 🤩 Schneller und freundlicher Service… stets sehr hilfsbereit und für jede Frage erreichbar!!! Die Arbeit wurde extrem schnell geliefert… Ich empfehle sie zu 100 % 👌👌",
      es: "Contraté al equipo para el bautizo de mi hija 🤩 Servicio rápido y amable... siempre muy atentos y disponibles para cualquier duda!!! Trabajo entregado rapidísimo... Los recomiendo al 100% 👌👌",
      fr: "J'ai engagé l'équipe pour le baptême de ma fille 🤩 Service rapide et sympathique… toujours très serviables et disponibles pour la moindre question !!! Travail livré très rapidement… Je les recommande à 100 % 👌👌",
    },
  },
  {
    id: "07931731-e2a8-4963-91a2-3e852db40986",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Hoje, juntamente com as minhas colegas, fizemos uma pequena sessão fotográfica com tema de Halloween, e o Sr. José deixou-nos completamente à vontade, usou toda a sua criatividade, e as fotos ficaram espetaculares. É, sem dúvida, um serviço a repetir — recomendo vivamente. Muito obrigada!",
      de: "Heute haben wir zusammen mit meinen Kolleginnen ein kleines Foto-Shooting zum Thema Halloween gemacht, und Herr José hat uns absolut entspannen lassen, seine ganze Kreativität eingesetzt und die Fotos sind spektakulär geworden. Definitiv ein Service, den man wiederholen sollte — sehr zu empfehlen. Vielen Dank!",
      es: "Hoy, junto con mis compañeras, hicimos una pequeña sesión de fotos con temática de Halloween, y el Sr. José nos hizo sentir totalmente cómodas, derrochó creatividad y las fotos quedaron espectaculares. Sin duda, un servicio para repetir — lo recomiendo muchísimo. ¡Mil gracias!",
      fr: "Aujourd'hui, avec mes collègues, nous avons fait une petite séance photo sur le thème d'Halloween, et M. José nous a totalement mises à l'aise, a utilisé toute sa créativité et les photos sont spectaculaires. Une prestation à refaire, sans aucun doute — je la recommande vivement. Merci beaucoup !",
    },
  },
  {
    id: "1771d109-407a-4d5a-859c-515596d77bd9",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Que profissional o Massimo é! Estou apaixonada pela foto que encomendei como prenda — o resultado da impressão é incrível.",
      de: "Was für ein Profi Massimo ist! Ich bin verliebt in das Foto, das ich als Geschenk bestellt habe — das Druckergebnis ist großartig.",
      es: "¡Qué profesional es Massimo! Estoy enamorada de la foto que encargué como regalo — el resultado en impresión es increíble.",
      fr: "Quel professionnel, ce Massimo ! Je suis amoureuse de la photo que j'ai commandée en cadeau, le rendu de l'impression est incroyable.",
    },
  },
  {
    id: "a6d16d0f-cbdd-4926-9e18-89900d9d57a1",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recomendo a Masha — uma abordagem muito profissional ao seu trabalho. Deixa-nos completamente à vontade em frente à câmara, é clara e direta, percebe do que faz. Encontra os teus melhores ângulos e cria uma atmosfera mesmo agradável. Muito, muito obrigada.",
      de: "Ich empfehle Masha — eine sehr professionelle Herangehensweise an ihre Arbeit. Sie lässt einen vor der Kamera komplett entspannen, ist klar und auf den Punkt, sie weiß, was sie tut. Sie sieht und findet deine besten Seiten und Winkel und schafft eine wirklich angenehme Atmosphäre. Vielen, vielen Dank.",
      es: "Recomiendo a Masha — un enfoque muy profesional en su trabajo. Te pone totalmente cómoda delante de la cámara, es clara y directa, sabe perfectamente lo que hace. Verá y encontrará tus mejores ángulos y creará un ambiente muy agradable. Muchísimas gracias.",
      fr: "Je recommande Masha — une approche très professionnelle de son travail. Elle vous met complètement à l'aise devant l'objectif, elle est claire et directe, elle maîtrise son métier. Elle saura voir et trouver vos meilleurs côtés et angles, et créer une ambiance vraiment agréable. Un grand merci.",
    },
  },
  {
    id: "180e583c-93dd-4e01-80df-f063be062e48",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Muito obrigada 😍😍😍 A sério, o ambiente da sessão foi super. Masha, és uma profissional incrível — toda a gente passou um ótimo momento, e até as pessoas que normalmente não gostam destas coisas me disseram que adoraram 🤣🤣",
      de: "Vielen, vielen Dank 😍😍😍 Ehrlich, die Atmosphäre beim Shooting war super. Masha, du bist eine unglaubliche Profi — alle hatten eine tolle Zeit, und sogar die Leute, die normalerweise so was nicht mögen, haben mir gesagt, dass sie es geliebt haben 🤣🤣",
      es: "Muchísimas gracias 😍😍😍 De verdad, el ambiente de la sesión fue increíble. Masha, eres una profesional increíble — todo el mundo lo pasó genial, e incluso las personas que normalmente no disfrutan de este tipo de cosas me dijeron que les encantó 🤣🤣",
      fr: "Merci beaucoup 😍😍😍 Sincèrement, l'ambiance de la séance était super. Masha, tu es une professionnelle incroyable — tout le monde a passé un super moment, et même les personnes qui n'aiment pas ce genre de chose d'habitude m'ont dit qu'elles avaient adoré 🤣🤣",
    },
  },
  {
    id: "5174eb86-f899-41c4-98fb-296ca40c93ba",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Lena, que fotografias deslumbrantes! Simplesmente alucinantes! Muito obrigada por uma abordagem criativa tão atenta e responsável — e pelas recomendações de roupa, pelo percurso bem pensado e por todos os conselhos sobre como me colocar e quando dar o beijo! Adoraaamos as fotos! ❤️",
      de: "Lena, was für umwerfende Fotos! Einfach atemberaubend! Vielen Dank für die so aufmerksame und verantwortungsvolle kreative Herangehensweise — und für die Outfit-Empfehlungen, die durchdachte Route und all die Tipps, wie ich mich hinstellen und wann ich küssen soll! Wir lieeeben die Fotos! ❤️",
      es: "Lena, ¡qué fotos tan impresionantes! ¡Simplemente alucinantes! Mil gracias por un enfoque creativo tan atento y responsable — y por las recomendaciones de ropa, por la ruta bien pensada y por todos los consejos sobre cómo posar y cuándo dar el beso. ¡Las amaaamos! ❤️",
      fr: "Lena, quelles photos magnifiques ! Tout simplement bluffantes ! Merci beaucoup pour cette approche créative si attentive et responsable — et pour les conseils vestimentaires, l'itinéraire bien pensé et toutes les indications sur comment me tenir et à quel moment s'embrasser ! Nous aaadorons les photos ! ❤️",
    },
  },
  {
    id: "ffc4c504-021c-41e3-b433-acce2ca3b90e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana fez parte do dia mais importante da minha vida — o meu casamento íntimo. Obrigada por eternizares este momento com a tua lente e a tua simpatia. Vamos lembrar-nos para sempre. Daqui a uns meses, a minha irmã vai dar uma festa e vou oferecer-te como fotógrafa! 😆",
      de: "Tatiana war Teil des wichtigsten Tages meines Lebens — meiner intimen Hochzeit. Danke, dass du diesen Moment mit deinem Objektiv und deiner Freundlichkeit verewigt hast. Wir werden uns immer daran erinnern. In ein paar Monaten gibt meine Schwester eine Feier, und ich werde dich als Fotografin verschenken! 😆",
      es: "Tatiana formó parte del día más importante de mi vida — mi boda íntima. Gracias por inmortalizar este momento con tu lente y con tu cariño. Lo recordaremos siempre. Dentro de unos meses, mi hermana va a dar una fiesta y voy a regalarte como fotógrafa 😆",
      fr: "Tatiana a fait partie du jour le plus important de ma vie — mon mariage intime. Merci d'avoir éternisé ce moment avec ton objectif et ta gentillesse. Nous nous en souviendrons toujours. Dans quelques mois, ma sœur organise une fête et je vais l'offrir une séance avec toi 😆",
    },
  },
  {
    id: "d05b2f00-63c1-43a0-ab0e-4f1b60dc64c2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recomendo vivamente o André. É uma pessoa cheia de energia, com paixão por captar momentos únicos e, acima de tudo, com amor pela fotografia. Obrigado por fazeres parte do nosso dia especial. 5 estrelas, e se pudéssemos dar mais, daríamos. Pablo & Luna.",
      de: "Ich empfehle André wärmstens. Er ist ein Mensch voller Energie, mit Leidenschaft dafür, einzigartige Momente einzufangen, und vor allem mit Liebe zur Fotografie. Danke, dass du Teil unseres besonderen Tages warst. 5 Sterne — und wenn wir mehr geben könnten, würden wir es tun. Pablo & Luna.",
      es: "Recomiendo muchísimo a André. Es una persona con muchísima energía, con pasión por captar el momento único y, sobre todo, con amor por la fotografía. Gracias por formar parte de nuestro día especial. 5 estrellas, y si pudiéramos dar más, lo haríamos. Pablo y Luna.",
      fr: "Je recommande vivement André. C'est une personne pleine d'énergie, avec une vraie passion pour capturer le moment unique, et surtout un véritable amour de la photographie. Merci de faire partie de notre journée si spéciale. 5 étoiles, et si nous pouvions en donner plus, nous le ferions. Pablo et Luna.",
    },
  },
  {
    id: "ed66e40f-435a-4323-bc24-d6b06715d347",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi uma experiência única, para mim cheia da presença do espírito, porque és uma pessoa iluminada, carismática e que presta atenção a cada pequeno detalhe. Foi uma experiência divertida e libertadora, que nos permitiu ser nós próprios graças à forma única como nos tratas!! Espero que, noutros momentos da minha vida, possa partilhar e viver esta experiência noutras circunstâncias! Que Deus te abençoe.",
      de: "Es war eine einzigartige Erfahrung, für mich erfüllt von der Gegenwart des Geistes, weil du ein erleuchteter, charismatischer Mensch bist, der auf jedes kleinste Detail achtet. Es war eine lustige, befreiende Erfahrung, die es uns ermöglicht hat, dank der einzigartigen Art, wie du uns behandelst, ganz wir selbst zu sein!! Ich hoffe, dass ich diese Erfahrung in anderen Lebensphasen wieder teilen und erleben kann! Möge Gott dich segnen.",
      es: "Fue una experiencia única, para mí llena de la presencia del espíritu, porque eres una persona iluminada, carismática y que presta atención a cada pequeño detalle. Fue una experiencia divertida y liberadora, que nos permitió ser nosotros mismos gracias a la manera única en que nos tratas. Espero, en otros momentos de mi vida, poder compartir y vivir esta experiencia en otras circunstancias. Que Dios te bendiga.",
      fr: "Ce fut une expérience unique, remplie pour moi de la présence de l'esprit, parce que vous êtes une personne lumineuse, charismatique et qui prête attention au moindre détail. Ce fut une expérience amusante et libératrice, qui nous a permis d'être nous-mêmes grâce à la manière unique avec laquelle vous nous traitez !! J'espère que, à d'autres moments de ma vie, je pourrai partager et vivre cette expérience dans d'autres circonstances ! Que Dieu vous bénisse.",
    },
  },
  {
    id: "83102250-5fdb-4a5b-b44a-ae92125450ac",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui é um excelente profissional, muito educado e de confiança. Durante os batizados dos meus filhos foi extremamente respeitador dos pedidos dos padres e da igreja, bem como de todos os ritos da cerimónia. Durante a festa, interagiu de forma muito positiva e respeitosa com os convidados e as crianças, deixando toda a gente confortável. Também nos ajudou a preparar os álbuns fotográficos, que são tão importantes para preservar a memória de dias e momentos especiais.",
      de: "Rui ist ein hervorragender Profi, sehr höflich und vertrauenswürdig. Bei den Taufen meiner Kinder hat er die Wünsche der Priester und der Kirche sowie alle Riten der Zeremonie extrem respektiert. Während der Feier hat er sehr positiv und respektvoll mit den Gästen und den Kindern interagiert und alle wohlfühlen lassen. Er hat uns auch dabei geholfen, die Fotoalben vorzubereiten, die so wichtig sind, um die Erinnerung an besondere Tage und Momente zu bewahren.",
      es: "Rui es un excelente profesional, muy educado y de confianza. Durante los bautizos de mis hijos fue extremadamente respetuoso con las peticiones de los curas y de la iglesia, y con todos los ritos de la ceremonia. Durante la fiesta, interactuó de una forma muy positiva y respetuosa con los invitados y los niños, haciendo que todos se sintieran cómodos. También nos ayudó a preparar los álbumes fotográficos, que son tan importantes para conservar el recuerdo de días y momentos especiales.",
      fr: "Rui est un excellent professionnel, très poli et digne de confiance. Lors des baptêmes de mes enfants, il a été extrêmement respectueux des demandes des prêtres et de l'église, ainsi que de tous les rites de la cérémonie. Pendant la fête, il a interagi de manière très positive et respectueuse avec les invités et les enfants, mettant tout le monde à l'aise. Il nous a également aidés à préparer les albums photo, si importants pour préserver le souvenir de journées et de moments si spéciaux.",
    },
  },
  {
    id: "21d753dc-b706-48f9-861d-f54a99f83650",
    title: {
      pt: "O melhor dia com a melhor pessoa para captar TODOS os momentos!",
      de: "Der schönste Tag mit der besten Person, um ALLE Momente einzufangen!",
      es: "¡El mejor día con la mejor persona para captar TODOS los momentos!",
      fr: "La meilleure journée avec la meilleure personne pour capturer TOUS les moments !",
    },
    text: {
      pt: "Conhecemos a Jennifer no casamento de uma amiga e foi logo a nossa primeira escolha. Por sorte, conseguimos tê-la presente no nosso dia. Aliás, esteve presente desde o dia em que a marcámos. Não há palavras para descrever a disponibilidade e a simpatia da Jennifer. Quanto ao trabalho — captou TODOS os momentos, todos os olhares, todas as lágrimas, todos os sorrisos. É impossível não amar o trabalho da Jennifer. Não tivemos de nos preocupar com nada. Aproveitámos, divertimo-nos e fomos verdadeiramente felizes. Entretanto, a Jennifer fazia magia com a sua lente. O resultado final não podia ter sido melhor. A nossa escolha foi A MELHOR! Obrigada, Jennifer 🥰\n\nDa Maria e do Zé Pedro",
      de: "Wir haben Jennifer auf der Hochzeit einer Freundin kennengelernt und sie war sofort unsere erste Wahl. Zum Glück konnten wir sie für unseren Tag gewinnen. Ehrlich gesagt war sie schon ab dem Tag, an dem wir sie gebucht haben, präsent. Es gibt keine Worte, um Jennifers Verfügbarkeit und Freundlichkeit zu beschreiben. Was die Arbeit betrifft — sie hat JEDEN Moment, jeden Blick, jede Träne, jedes Lächeln eingefangen. Es ist unmöglich, Jennifers Arbeit nicht zu lieben. Wir mussten uns um nichts kümmern. Wir haben einfach genossen, Spaß gehabt und waren wirklich glücklich. Währenddessen hat Jennifer mit ihrem Objektiv gezaubert. Das Endergebnis hätte nicht besser sein können. Unsere Wahl war DIE BESTE! Danke, Jennifer 🥰\n\nVon Maria und Zé Pedro",
      es: "Conocimos a Jennifer en la boda de una amiga y enseguida fue nuestra primera elección. Por suerte, pudimos contar con su presencia en nuestro día. De hecho, estuvo presente desde el día en que la reservamos. No hay palabras para describir la disponibilidad y la amabilidad de Jennifer. En cuanto al trabajo — captó TODOS los momentos, cada mirada, cada lágrima, cada sonrisa. Es imposible no enamorarse del trabajo de Jennifer. No tuvimos que preocuparnos por nada. Disfrutamos, nos divertimos y fuimos verdaderamente felices. Mientras tanto, Jennifer hacía magia con su cámara. ¡El resultado final no podía haber sido mejor! Nuestra elección fue LA MEJOR. Gracias, Jennifer 🥰\n\nDe Maria y Zé Pedro",
      fr: "Nous avons rencontré Jennifer au mariage d'une amie et elle a tout de suite été notre premier choix. Par chance, nous avons pu l'avoir pour notre journée. D'ailleurs, elle a été présente dès le jour où nous l'avons réservée. Il n'y a pas de mots pour décrire la disponibilité et la gentillesse de Jennifer. Quant à son travail — elle a capturé TOUS les moments, chaque regard, chaque larme, chaque sourire. Il est impossible de ne pas aimer le travail de Jennifer. Nous n'avons eu à nous soucier de rien. Nous avons profité, nous nous sommes amusés et nous avons vraiment été heureux. Pendant ce temps, Jennifer faisait de la magie avec son objectif. Le résultat final ne pouvait pas être meilleur. Notre choix a été LE MEILLEUR ! Merci, Jennifer 🥰\n\nDe Maria et Zé Pedro",
    },
  },
  {
    id: "eff3b50c-70bb-4ab9-a2cb-584ac7fe83d3",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Giovana, as fotos estão PERFEITAS!!! Muito obrigada por isto. Tive uma semana super intensa e emocionalmente desgastante no trabalho, e estas fotos encheram-me o coração de amor. A forma como captaste a nossa família foi incrível. A sério, obrigada. 🤍",
      de: "Giovana, die Fotos sind PERFEKT!!! Vielen, vielen Dank dafür. Ich hatte eine super volle, emotional auslaugende Woche bei der Arbeit, und diese Fotos haben mein Herz mit Liebe gefüllt. Die Art, wie du unsere Familie eingefangen hast, war unglaublich. Wirklich, danke. 🤍",
      es: "Giovana, las fotos están PERFECTAS!!! Mil gracias por esto. He tenido una semana super intensa y emocionalmente agotadora en el trabajo, y estas fotos me llenaron el corazón de amor. La forma en que captaste a nuestra familia fue increíble. De verdad, gracias. 🤍",
      fr: "Giovana, les photos sont PARFAITES !!! Merci beaucoup pour ça. J'ai eu une semaine super intense et émotionnellement épuisante au travail, et ces photos m'ont rempli le cœur d'amour. La manière dont tu as capturé notre famille était incroyable. Vraiment, merci. 🤍",
    },
  },
  {
    id: "d145d15a-740b-431c-93e4-8a714a82df0f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Kristina, estas estão absolutamente lindas. Adoro como ficaram leves e arejadas. Perfeitas! Muito, muito obrigada!",
      de: "Kristina, sie sind absolut wunderschön. Ich liebe, wie leicht und luftig sie wirken. Perfekt! Vielen, vielen Dank!",
      es: "Kristina, estas son absolutamente preciosas. Me encanta lo ligeras y luminosas que han quedado. ¡Perfectas! ¡Mil, mil gracias!",
      fr: "Kristina, elles sont absolument magnifiques. J'adore à quel point elles sont légères et aériennes. Parfaites ! Merci beaucoup !",
    },
  },
  {
    id: "736a0f02-394f-4c6f-a2c4-4ddc448ae3a5",
    title: {
      pt: "Simpatia, empatia e atenção!",
      de: "Freundlichkeit, Empathie und Aufmerksamkeit!",
      es: "¡Simpatía, empatía y atención!",
      fr: "Gentillesse, empathie et attention !",
    },
    text: {
      pt: "Quando comecei a procurar fotógrafa, o que eu mais queria era alguém que conseguisse captar os momentos mais felizes de uma forma leve e calma.\n\nDei com o perfil da Jennifer e fiquei encantada logo desde o início pelo seu trabalho — e ainda mais depois da nossa primeira conversa.\n\nDesde o primeiro momento, a Jennifer foi super atenta, simpática, e fez-nos sentir imediatamente à vontade.\n\nDeu indicações, valorizou as nossas perguntas e, no próprio dia, teve a capacidade de nos fazer (a nós e aos convidados) sentir completamente confortáveis.\n\nDepois de receber as fotos, ainda tivemos mais a certeza de que tínhamos feito a melhor escolha.\n\nCada momento captado da melhor forma, cada detalhe, e fotos que transmitem mesmo o sentir do momento.\n\nSimplesmente INCRÍVEL!\n\nOBRIGADA, JENNIFER!\n\nNo nosso coração para sempre. 🤍",
      de: "Als ich anfing, eine Fotografin zu suchen, wollte ich vor allem jemanden, der die schönsten Momente leicht und ruhig einfängt.\n\nIch bin auf Jennifers Profil gestoßen und war von Anfang an von ihrer Arbeit verzaubert — und noch mehr nach unserem ersten Gespräch.\n\nVon Beginn an war Jennifer super aufmerksam, freundlich und hat uns sofort entspannen lassen.\n\nSie hat Anregungen gegeben, unsere Fragen geschätzt und am Tag selbst die Fähigkeit gehabt, uns (und die Gäste) absolut entspannt sein zu lassen.\n\nAls wir die Fotos bekamen, waren wir noch sicherer, dass wir die beste Wahl getroffen hatten.\n\nJeder Moment auf die schönste Weise eingefangen, jedes Detail, und Fotos, die das Gefühl dieses Tages wirklich transportieren.\n\nEinfach UNGLAUBLICH!\n\nDANKE, JENNIFER!\n\nFür immer in unseren Herzen. 🤍",
      es: "Cuando empecé a buscar fotógrafa, lo que más quería era encontrar a alguien capaz de captar los momentos más felices de una forma ligera y tranquila.\n\nDi con el perfil de Jennifer y quedé encantada desde el primer momento con su trabajo — y aún más tras nuestra primera conversación.\n\nDesde el primer momento, Jennifer fue súper atenta, simpática y nos hizo sentir cómodos enseguida.\n\nDio indicaciones, valoró nuestras preguntas y, el día de la boda, tuvo la capacidad de hacernos sentir (a nosotros y a los invitados) totalmente cómodos.\n\nAl recibir las fotos, tuvimos aún más claro que habíamos hecho la mejor elección.\n\nCada momento captado de la mejor forma, cada detalle, y fotos que transmiten el sentir del instante.\n\n¡Simplemente INCREÍBLE!\n\n¡GRACIAS, JENNIFER!\n\nEn nuestro corazón para siempre. 🤍",
      fr: "Quand j'ai commencé à chercher une photographe, ce que je voulais le plus, c'était quelqu'un capable de capturer les moments les plus heureux de manière légère et calme.\n\nJe suis tombée sur le profil de Jennifer et j'ai été enchantée dès le début par son travail — et encore plus après notre première conversation.\n\nDès le premier instant, Jennifer a été super attentive, sympathique et nous a tout de suite mis à l'aise.\n\nElle nous a guidés, a valorisé nos questions, et le jour J, elle a eu cette capacité à nous mettre, nous et nos invités, complètement à l'aise.\n\nAprès avoir reçu les photos, nous avons été encore plus sûrs d'avoir fait le meilleur choix.\n\nChaque moment capturé de la plus belle façon, chaque détail, et des photos qui transmettent vraiment le ressenti du moment.\n\nTout simplement INCROYABLE !\n\nMERCI, JENNIFER !\n\nDans nos cœurs pour toujours. 🤍",
    },
  },
  {
    id: "ee427c3f-268d-4c5e-b0a5-adb59838fe07",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Giovana, meu Deus — acabei de ver as fotos com calma e fiquei sem palavras. Ficaram tão lindas 🥺. Captaste exatamente o que este momento significa para nós, enquanto família, e isso não tem preço.\n\nO teu olhar é tão sensível. Sente-se o amor em cada foto, sabes? Obrigada por criares este registo para nós. Estas imagens vão ser uma memória muito especial para a nossa família.\n\nA sério, muito, muito obrigada. Ficou maravilhoso. 🤍",
      de: "Giovana, mein Gott — ich habe mir die Fotos gerade in Ruhe angesehen und bin sprachlos. Sie sind so wunderschön geworden 🥺. Du hast genau das eingefangen, was dieser Moment für uns als Familie bedeutet, und das ist unbezahlbar.\n\nDein Blick ist so feinfühlig. Man spürt die Liebe in jedem Foto, weißt du? Danke, dass du diese Erinnerung für uns geschaffen hast. Diese Bilder werden für unsere Familie eine ganz besondere Erinnerung sein.\n\nWirklich, vielen, vielen Dank. Es ist wunderschön geworden. 🤍",
      es: "Giovana, madre mía — acabo de ver las fotos con calma y me he quedado sin palabras. Quedaron preciosas 🥺. Captaste exactamente lo que significa este momento para nosotros como familia, y eso no tiene precio.\n\nTu mirada es muy sensible. Se siente el amor en cada foto, ¿sabes? Gracias por crear este recuerdo para nosotros. Estas imágenes serán un recuerdo muy especial para nuestra familia.\n\nDe verdad, muchísimas gracias. Quedó maravilloso. 🤍",
      fr: "Giovana, mon Dieu — je viens de regarder tranquillement les photos et je suis sans voix. Elles sont si belles 🥺. Tu as capturé exactement ce que ce moment représente pour nous en tant que famille, et cela n'a pas de prix.\n\nTon regard est si sensible. On ressent l'amour dans chaque photo, tu sais ? Merci d'avoir créé ce souvenir pour nous. Ces images seront un souvenir très précieux pour notre famille.\n\nVraiment, merci infiniment. C'est magnifique. 🤍",
    },
  },
  {
    id: "7efa8d01-d44d-43ce-a178-882e82504781",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O meu noivo e eu viajámos do Colorado a Portugal e queríamos tirar umas fotos de noivado únicas e bonitas enquanto cá estivéssemos. Encontrámos a Patricia depois de algumas pesquisas rápidas e apaixonámo-nos imediatamente pelo seu estilo e pela sua abordagem à sessão fotográfica. Adorámos não parecer estéril nem rígido, mas ser uma \"experiência\", e ela tinha imensas perguntas giras para nós respondermos um ao outro durante a sessão. Pareceu um encontro romântico e divertido, em vez de uma tarefa. Foi muito fácil entrar em contacto com ela quanto a locais de encontro e pagamentos. Como começámos a marcação ainda nos EUA, senti que tudo correu de forma incrivelmente fluida. Achei-a muito acessível e até manteve-se atenta ao tempo, mantendo-nos atualizados com um plano alternativo por causa das tempestades de chuva. Foi maravilhosa de trabalhar e, se voltarmos a Portugal ou formos ao Reino Unido (outro local onde trabalha), iríamos contratá-la novamente. Foi simplesmente incrível e fez muito mais do que o esperado em tudo. Mesmo quando tivemos algumas dificuldades a fazer download das fotos, reenviou os links e garantiu que tudo corresse bem. Outro bónus é a contribuição que faz para causas solidárias com parte do dinheiro da sessão. Vale super a pena, e as fotos ficaram simplesmente perfeitas e exatamente como tínhamos imaginado!",
      de: "Mein Verlobter und ich sind aus Colorado nach Portugal gereist und wollten dort einzigartige, wunderschöne Verlobungsfotos. Nach ein paar kurzen Recherchen sind wir auf Patricia gestoßen und haben uns sofort in ihren Stil und ihre Herangehensweise an das Shooting verliebt. Es war für uns wichtig, dass es nicht steril und steif wirkt, sondern eher wie eine „Erfahrung\" — und sie hatte ganz viele süße Fragen, die mein Verlobter und ich uns während des Shootings gegenseitig beantworten konnten. Es fühlte sich an wie ein Date und nicht wie eine lästige Pflicht. Die Kommunikation, Treffpunkte und Zahlungen waren super einfach. Da wir die Buchung aus den USA gestartet haben, hat alles unglaublich reibungslos geklappt. Sie war sehr unkompliziert und hat sogar das Wetter im Blick behalten und uns wegen der Regenstürme über einen Plan B auf dem Laufenden gehalten. Mit ihr zu arbeiten war wundervoll, und wenn wir je wieder nach Portugal kommen oder ins Vereinigte Königreich reisen (wo sie ebenfalls arbeitet), würden wir sie sofort wieder buchen. Sie war einfach großartig und hat in allem mehr gegeben als erwartet. Selbst als wir Probleme beim Herunterladen der Fotos hatten, hat sie die Links erneut geschickt und dafür gesorgt, dass alles glattlief. Ein weiterer Pluspunkt: ein Teil des Geldes, das man für das Shooting zahlt, geht an wohltätige Zwecke. Es lohnt sich absolut, und die Fotos sind einfach perfekt geworden — genau so, wie wir es uns vorgestellt hatten!",
      es: "Mi prometido y yo viajamos desde Colorado a Portugal y queríamos hacernos unas fotos de pedida únicas y bonitas durante el viaje. Encontramos a Patricia tras unas búsquedas rápidas y nos enamoramos enseguida de su estilo y de su enfoque de la sesión. Nos encantó que no se sintiera estéril ni rígido, sino que fuera una \"experiencia\", y tenía un montón de preguntas bonitas para que mi prometido y yo nos respondiéramos durante la sesión. Pareció una cita romántica y divertida en lugar de una tarea. Fue muy fácil contactar con ella, tanto para los puntos de encuentro como para los pagos. Al empezar a planificar las fotos desde EE. UU., sentí que todo fluyó increíblemente bien. Es muy cercana e incluso estuvo pendiente del tiempo, manteniéndonos al tanto con un plan B por las tormentas de lluvia. Fue maravilloso trabajar con ella y, si volvemos a Portugal o vamos al Reino Unido (otro lugar donde trabaja), la contrataríamos sin dudar. Fue simplemente increíble y siempre fue más allá. Incluso cuando tuvimos algún problema para descargar las fotos, nos volvió a mandar los enlaces y se aseguró de que todo saliera bien. Otro plus es que parte del dinero que se gasta en la sesión va a obras benéficas. Vale muchísimo la pena, y las fotos quedaron perfectas, justo como imaginábamos!",
      fr: "Mon fiancé et moi avons voyagé du Colorado au Portugal et voulions faire de belles photos de fiançailles uniques pendant notre séjour. Nous avons trouvé Patricia après quelques recherches rapides et nous sommes immédiatement tombés amoureux de son style et de son approche de la séance. Nous avons aimé que cela ne paraisse pas stérile ni rigide, mais plutôt une \"expérience\", et elle avait plein de jolies questions à se poser pour mon fiancé et moi pendant la séance. C'était comme un rendez-vous romantique amusant plutôt qu'une corvée. Il a été très facile d'entrer en contact avec elle pour les rendez-vous et les paiements. Comme nous avons commencé à organiser depuis les États-Unis, j'ai trouvé que tout s'est déroulé incroyablement bien. Elle est très accessible et a même surveillé la météo, nous tenant au courant avec un plan de secours en cas de pluie. Travailler avec elle a été merveilleux, et si nous revenons au Portugal ou allons au Royaume-Uni (un autre endroit où elle travaille), nous l'engagerons à nouveau. Elle était tout simplement incroyable et a fait plus que ce qui était attendu pour tout. Même lorsque nous avons eu un problème pour télécharger les photos, elle a renvoyé les liens et s'est assurée que tout se passe bien. Autre bonus : elle reverse une partie de l'argent dépensé à des œuvres caritatives. Cela vaut totalement le coup, et les photos sont parfaites, exactement ce que nous avions imaginé !",
    },
  },
  {
    id: "456e9ae8-6b29-4b6f-80ce-6afd91f7c068",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Pronto, escolhidas! Decidimos por 50, mas mesmo assim foi difícil 😅 — mas estão mesmo maravilhosas!!! Vamos ter uma recordação linda de um país tão sentimental 😍❤️❤️",
      de: "Okay, ausgewählt! Wir haben uns für 50 entschieden, aber es war trotzdem schwer 😅 — aber sie sind wirklich wunderbar!!! Wir bekommen eine wunderschöne Erinnerung an ein so emotionales Land 😍❤️❤️",
      es: "¡Listo, elegidas! Nos decidimos por 50, pero aun así fue difícil 😅 — ¡pero de verdad están maravillosas! Vamos a tener un precioso recuerdo de un país tan sentimental 😍❤️❤️",
      fr: "Voilà, choisies ! Nous nous sommes décidés pour 50, mais c'était quand même difficile 😅 — mais elles sont vraiment magnifiques !!! Nous aurons un magnifique souvenir d'un pays si chargé d'émotion 😍❤️❤️",
    },
  },
  {
    id: "6e33755b-329b-4431-9279-d2e97fdb9f7b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi uma experiência maravilhosa, super agradável — eu e a minha família adorámos. A Débora é muito profissional e prestável; esteve sempre disponível, sempre pronta a responder às minhas dúvidas e a dar todo o apoio necessário para tornar o nosso grande dia especial — e foi mesmo. Um enorme obrigado em nome da minha família.",
      de: "Es war eine wundervolle Erfahrung, super angenehm — ich und meine Familie haben es geliebt. Débora ist sehr professionell und hilfsbereit; sie war stets erreichbar, immer bereit, meine Fragen zu beantworten und alle notwendige Unterstützung zu bieten, damit unser großer Tag besonders wird — und das war er. Ein riesiges Dankeschön im Namen meiner Familie.",
      es: "Fue una experiencia maravillosa, súper agradable — mi familia y yo lo disfrutamos muchísimo. Débora es muy profesional y atenta; siempre estuvo disponible, siempre dispuesta a responder a mis preguntas y a brindar todo el apoyo necesario para hacer que nuestro gran día fuera especial — y lo fue. Un enorme gracias en nombre de mi familia.",
      fr: "Ce fut une expérience merveilleuse, super agréable — ma famille et moi avons adoré. Débora est très professionnelle et serviable ; elle a toujours été disponible, toujours prête à répondre à mes questions et à apporter tout le soutien nécessaire pour faire de notre grand jour quelque chose de spécial — et il l'a vraiment été. Un immense merci au nom de ma famille.",
    },
  },
  {
    id: "a3ece324-79bc-480e-8362-7fbef2837f29",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fotos lindas tiradas ao pôr do sol. A fotógrafa, Isa, é muito organizada e deixa-nos imediatamente à vontade. Recomendo vivamente.",
      de: "Wunderschöne Fotos im Sonnenuntergang. Die Fotografin, Isa, ist sehr gut organisiert und lässt einen sofort entspannen. Sehr zu empfehlen.",
      es: "Fotos preciosas hechas al atardecer. La fotógrafa, Isa, está muy organizada y te pone cómoda enseguida. La recomiendo muchísimo.",
      fr: "De magnifiques photos prises au coucher du soleil. La photographe, Isa, est très organisée et vous met immédiatement à l'aise. Je la recommande vivement.",
    },
  },
  {
    id: "5ef36b7d-1557-46bb-a9ce-dbbd8b50ed24",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Incrível! A Isa é maravilhosa e deixa-nos super à vontade!!!! Recomendamos a 100%! Mal podemos esperar por outra sessão neste verão!",
      de: "Unglaublich! Isa ist großartig und lässt einen total entspannen!!!! Wir empfehlen sie zu 100 %! Wir können das nächste Shooting in diesem Sommer kaum erwarten!",
      es: "¡Increíble! Isa es maravillosa y te pone súper cómoda!!!! La recomendamos al 100%! ¡No vemos la hora de tener otra sesión este verano!",
      fr: "Incroyable ! Isa est merveilleuse et vous met super à l'aise !!!! Nous la recommandons à 100 % ! Nous avons hâte de refaire une séance cet été !",
    },
  },
  {
    id: "07822ec3-632b-4bf1-8571-1de713cb552c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos uma experiência incrível! Desde o primeiro contacto à entrega das fotos, tudo foi conduzido com grande profissionalismo. A Isa foi sempre muito rápida, organizada e atenta. Tanto na sessão pré-casamento como no dia do casamento, conseguiu conduzir tudo com muita facilidade, boa disposição e tranquilidade, o que nos deixou super confortáveis durante todo o processo. Isso fez toda a diferença para conseguirmos aproveitar cada momento. As fotografias superaram completamente as nossas expectativas — ficámos verdadeiramente surpreendidos com o resultado! Conseguiram captar emoções, detalhes e momentos muito especiais. Adorámos todo o apoio e o resultado final. Recomendamos de coração! 📸✨",
      de: "Wir hatten eine unglaubliche Erfahrung! Vom ersten Kontakt bis zur Übergabe der Fotos wurde alles mit großer Professionalität geleitet. Isa war stets sehr schnell, organisiert und aufmerksam. Sowohl beim Pre-Wedding-Shooting als auch am Hochzeitstag hat sie alles mit großer Leichtigkeit, guter Laune und Ruhe geführt, sodass wir uns während des gesamten Prozesses super wohlgefühlt haben. Das hat den entscheidenden Unterschied gemacht, damit wir jeden Moment genießen konnten. Die Fotos haben unsere Erwartungen komplett übertroffen — wir waren wirklich vom Ergebnis überrascht! Sie haben Emotionen, Details und ganz besondere Momente eingefangen. Wir haben die gesamte Begleitung und das Endergebnis geliebt. Wir empfehlen sie von Herzen! 📸✨",
      es: "¡Tuvimos una experiencia increíble! Desde el primer contacto hasta la entrega de las fotos, todo se llevó con un gran profesionalismo. Isa siempre fue muy rápida, organizada y atenta. Tanto en la sesión preboda como en el día de la boda, supo conducir todo con mucha facilidad, buen humor y tranquilidad, lo que nos hizo sentir súper cómodos durante todo el proceso. Eso marcó toda la diferencia para que pudiéramos disfrutar de cada momento. ¡Las fotos superaron por completo nuestras expectativas! Nos sorprendieron de verdad con el resultado. Consiguieron captar emociones, detalles y momentos muy especiales. Nos encantó todo el acompañamiento y el resultado final. Lo recomendamos de corazón! 📸✨",
      fr: "Nous avons vécu une expérience incroyable ! Du premier contact à la livraison des photos, tout a été mené avec un grand professionnalisme. Isa a toujours été très rapide, organisée et attentive. Tant lors de la séance avant le mariage qu'au jour J, elle a su tout mener avec beaucoup d'aisance, de bonne humeur et de calme, ce qui nous a mis super à l'aise tout au long du processus. Cela a fait toute la différence pour que nous puissions profiter de chaque instant. Les photos ont totalement dépassé nos attentes — nous avons été vraiment surpris par le résultat ! Ils ont su capturer des émotions, des détails et des moments très spéciaux. Nous avons adoré tout l'accompagnement et le résultat final. Nous le recommandons de tout cœur ! 📸✨",
    },
  },
  {
    id: "f3b29fb1-5e17-43a1-b274-de12582d5627",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Se estás minimamente a pensar em fazer uma sessão fotográfica, marca já com a Viktoriia — não precisas de procurar mais. Foi maravilhoso trabalhar com ela! Demorámos um par de tentativas a acertar todos os detalhes, mas ela foi muito paciente, atenta e disponível. Depois, na própria sessão, foi um prazer trabalhar com ela — gentil e simpática. Trabalhou muito bem com todas as nossas idades, dos 70 aos 7 anos. Estamos super felizes com as fotos! Estão deslumbrantes e a edição é linda! É incrivelmente talentosa em fotografia. Não te vais arrepender!",
      de: "Wenn ihr auch nur ansatzweise über ein Fotoshooting nachdenkt, bucht jetzt Viktoriia — ihr müsst nicht weitersuchen. Es war wundervoll, mit ihr zu arbeiten! Wir haben ein paar Anläufe gebraucht, um alle Details zu klären, aber sie war so geduldig, gewissenhaft und reaktionsschnell. Beim Shooting selbst war es eine Freude, mit ihr zu arbeiten — sie ist freundlich und sympathisch. Sie hat mit allen unseren Altersgruppen großartig gearbeitet, von 70 bis 7 Jahren. Wir sind extrem zufrieden mit unseren Fotos! Sie sind atemberaubend, und sie hat sie wunderschön bearbeitet! Sie ist unglaublich talentiert. Ihr werdet nicht enttäuscht sein!",
      es: "Si estás pensando aunque sea un poquito en hacer una sesión, reserva ya con Viktoriia — no hace falta seguir buscando. ¡Fue maravilloso trabajar con ella! Nos costó un par de intentos cerrar todos los detalles, pero fue súper paciente, atenta y receptiva. Luego, en la propia sesión, fue un placer trabajar con ella — muy amable y simpática. Trabajó genial con todas nuestras edades, de 70 a 7 años. Estamos súper contentos con las fotos. Están impresionantes y la edición es preciosa. Tiene un talento increíble. ¡No te decepcionará!",
      fr: "Si vous envisagez ne serait-ce qu'un instant une séance photo, réservez avec Viktoriia maintenant — inutile de chercher plus loin. Travailler avec elle a été merveilleux ! Il nous a fallu plusieurs allers-retours pour caler tous les détails, mais elle a été très patiente, méticuleuse et réactive. Ensuite, lors de la séance elle-même, c'était un plaisir de travailler avec elle — gentille et sympathique. Elle a très bien géré tous nos âges, de 70 à 7 ans. Nous sommes super satisfaits de nos photos ! Elles sont magnifiques et la retouche est sublime ! Elle a un talent incroyable en photographie. Vous ne serez pas déçus !",
    },
  },
  {
    id: "0df2c02f-02c3-422d-8727-9f2bb18e1aba",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Viktoriia é uma fotógrafa incrível. A câmara dela capta-nos lindamente em cenários espetaculares de Lisboa. Um enorme obrigado por me dares memórias tão incríveis da minha viagem — mal posso esperar por voltar e fazer isto outra vez com ela. Recomendo vivamente trabalhar com ela e captar lindas memórias da tua viagem.",
      de: "Viktoriia ist eine unglaubliche Fotografin. Ihre Kamera fängt einen wunderschön vor den spektakulären Lissabon-Kulissen ein. Ein riesiges Dankeschön für die unglaublichen Erinnerungen an meine Reise — ich kann es kaum erwarten, zurückzukommen und das mit ihr noch einmal zu machen. Ich empfehle es jedem, mit ihr zu arbeiten und wunderschöne Erinnerungen an die eigene Reise festzuhalten.",
      es: "Viktoriia es una fotógrafa increíble. Su cámara te captura de una forma preciosa en escenarios espectaculares de Lisboa. Mil gracias por darme unos recuerdos tan increíbles de mi viaje — no veo la hora de volver y volver a hacerlo con ella. Recomiendo muchísimo trabajar con ella y captar bonitos recuerdos de tu viaje.",
      fr: "Viktoriia est une photographe incroyable. Son appareil vous capture magnifiquement dans des décors spectaculaires de Lisbonne. Un immense merci pour ces merveilleux souvenirs de mon voyage — j'ai hâte d'y retourner et de refaire cela avec elle. Je recommande vivement de travailler avec elle et de capturer de jolis souvenirs de votre voyage.",
    },
  },
  {
    id: "357410a8-901a-4b4e-97b3-5fe4eafa0e28",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uau, recomendo imenso! Eu e o meu marido contratámos a Viktoriia para algumas fotos de anúncio de gravidez, e ficaram ainda melhores do que poderíamos ter esperado. Tornou todo o processo super fluido e agradável! Sem dúvida, marca com ela se estiveres em Lisboa!",
      de: "Wow, absolute Empfehlung! Mein Mann und ich haben Viktoriia für ein paar Schwangerschaftsankündigungs-Fotos engagiert, und sie sind noch besser geworden, als wir es uns erhofft hatten. Sie hat den ganzen Ablauf super entspannt und angenehm gemacht! Auf jeden Fall mit ihr buchen, wenn ihr in Lissabon seid!",
      es: "¡Guau, lo recomiendo muchísimo! Mi marido y yo contratamos a Viktoriia para unas fotos de anuncio de embarazo, y quedaron incluso mejor de lo que podíamos haber esperado. Hizo que todo el proceso fuera súper fluido y agradable. ¡Reserva con ella sin dudarlo si estás en Lisboa!",
      fr: "Wow, je recommande à fond ! Mon mari et moi avons fait appel à Viktoriia pour des photos d'annonce de grossesse, et elles sont encore mieux que ce que nous aurions pu espérer. Elle a rendu tout le processus super fluide et agréable ! Foncez la réserver si vous êtes à Lisbonne !",
    },
  },
  {
    id: "4918b9e7-ae91-476f-b878-bd7e0d12cdf1",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Curto, fácil e divertido, mesmo para um casal que não adora ser fotografado. As fotos ficaram lindas!",
      de: "Kurz, unkompliziert und lustig, sogar für ein Paar, das nicht gerne fotografiert wird. Die Bilder sind wunderschön geworden!",
      es: "Corto, fácil y divertido, incluso para una pareja a la que no le encanta hacerse fotos. ¡Las fotos quedaron preciosas!",
      fr: "Court, simple et amusant, même pour un couple qui n'aime pas être pris en photo. Les photos sont magnifiques !",
    },
  },
  {
    id: "7848d03f-c2db-4256-9b19-d8271f8ca339",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalhar com a Cindy tem sido sempre uma experiência muito confortável. É flexível com o planeamento e pensa connosco em cada passo, antes e durante a sessão. Durante os meus retiros, consegue ficar quase invisível, mas ainda assim capta os momentos importantes. As fotos são naturais e genuínas, e nelas sinto-me bonita e como eu mesma. Como me deixa à vontade, as sessões são sempre tranquilas e confortáveis.",
      de: "Mit Cindy zu arbeiten ist immer eine sehr angenehme Erfahrung. Sie ist flexibel bei der Planung und denkt sowohl im Vorfeld als auch während des Shootings wirklich mit. Bei meinen Retreats schafft sie es, fast unsichtbar zu bleiben und trotzdem die wichtigen Momente einzufangen. Die Fotos wirken natürlich und echt, und ich finde mich darauf schön und ganz wie ich selbst. Da sie mich entspannen lässt, fühlen sich die Shootings immer locker und angenehm an.",
      es: "Trabajar con Cindy siempre ha sido una experiencia muy cómoda. Es flexible con la planificación y realmente piensa con nosotros, tanto antes como durante la sesión. En mis retiros consigue pasar casi inadvertida, sin dejar por ello de captar los momentos importantes. Las fotos transmiten naturalidad y autenticidad, y en ellas me veo guapa y siento que soy yo. Como me pone tan cómoda, las sesiones siempre son relajadas y agradables.",
      fr: "Travailler avec Cindy a toujours été une expérience très agréable. Elle est flexible dans l'organisation et réfléchit vraiment avec nous, à la fois en amont et pendant la séance. Lors de mes retraites, elle parvient à se faire presque invisible tout en capturant les moments importants. Les photos sont naturelles et authentiques, et je m'y trouve belle et fidèle à moi-même. Parce qu'elle me met à l'aise, les séances sont toujours détendues et confortables.",
    },
  },
  {
    id: "7fd464ec-f5c9-4d33-b60e-ce499cbcb902",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Serviço excecional! Excelente profissional, com um trabalho de elevada qualidade. Adorámos as várias fotos que tivemos, desde a sessão de maternidade ao batizado do nosso bebé. Sem dúvida, vão continuar a fazer parte da história da nossa família.",
      de: "Außergewöhnlicher Service! Hervorragender Profi mit erstklassiger Arbeit. Wir haben die verschiedenen Fotos geliebt, die wir gemacht haben — vom Schwangerschafts-Shooting bis zur Taufe unseres Babys. Ohne Zweifel werden sie weiter Teil unserer Familiengeschichte sein.",
      es: "¡Servicio excepcional! Excelente profesional, con un trabajo de gran calidad. Nos encantaron las distintas fotos que hicimos, desde la sesión de maternidad hasta el bautizo de nuestro bebé. Sin duda, seguirán formando parte de la historia de nuestra familia.",
      fr: "Service exceptionnel ! Excellent professionnel, avec un travail de très grande qualité. Nous avons adoré les différentes photos que nous avons faites, de la séance grossesse au baptême de notre bébé. Sans aucun doute, ils continueront à faire partie de l'histoire de notre famille.",
    },
  },
  {
    id: "84e53bee-476e-4350-8c72-2f5ba292a636",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A nossa família Costa adorou mesmo o teu trabalho fotográfico — 5 estrelas! Cada plano captou exatamente aquilo que esperávamos, e a experiência em si foi um prazer do início ao fim.",
      de: "Unsere Familie Costa hat deine fotografische Arbeit wirklich geliebt — 5 Sterne! Jede Aufnahme hat genau das eingefangen, was wir uns gewünscht hatten, und das Erlebnis selbst war von Anfang bis Ende ein Vergnügen.",
      es: "Nuestra familia Costa adoró tu trabajo fotográfico — ¡5 estrellas! Cada toma capturó justo lo que esperábamos, y la experiencia en sí fue un placer de principio a fin.",
      fr: "Notre famille Costa a vraiment adoré votre travail photographique — 5 étoiles ! Chaque cliché a capté exactement ce que nous espérions, et l'expérience elle-même a été un plaisir du début à la fin.",
    },
  },
  {
    id: "ad8b0eea-b7a1-46d5-be54-72acd851f473",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não há palavras para descrever o trabalho da Chris. Super prestável, carismática e com uma dedicação maravilhosa. Adorei as fotos e o vídeo do meu casamento. Recomendo vivamente. 🤍 …",
      de: "Es gibt keine Worte, um Chris' Arbeit zu beschreiben. Super hilfsbereit, charismatisch und mit wundervoller Hingabe. Ich habe die Fotos und das Video meiner Hochzeit geliebt. Sehr zu empfehlen. 🤍 …",
      es: "No hay palabras para describir el trabajo de Chris. Súper atenta, carismática y con una dedicación maravillosa. Me encantaron las fotos y el vídeo de mi boda. La recomiendo muchísimo. 🤍 …",
      fr: "Il n'y a pas de mots pour décrire le travail de Chris. Super serviable, charismatique et avec un dévouement merveilleux. J'ai adoré les photos et la vidéo de mon mariage. Je la recommande vivement. 🤍 …",
    },
  },
  {
    id: "83c291e4-5f29-4fcf-b3b5-6a9f8321818b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O tour fotográfico que fizemos com a Chris foi incrível! Queria tirar fotos com a minha mãe e o meu irmão e a ideia de o fazer enquanto íamos conhecendo a cidade deixou-me entusiasmada! A Chris foi muito divertida para passear e as fotos ficaram tão incríveis que ficámos com muita dificuldade em escolher quais queríamos 😅. Voltava a fazê-lo de certeza, se um dia voltar ao Porto!",
      de: "Die Foto-Tour, die wir mit Chris gemacht haben, war unglaublich! Ich wollte Fotos mit meiner Mutter und meinem Bruder machen, und die Idee, das beim Erkunden der Stadt zu tun, hat mich total begeistert! Es war total lustig, mit Chris durch die Stadt zu spazieren, und ihre Fotos waren so toll, dass es uns wirklich schwer gefallen ist auszuwählen, welche wir behalten wollen 😅. Ich würde es jederzeit wieder tun, falls ich irgendwann wieder in Porto bin!",
      es: "¡El tour fotográfico que hicimos con Chris fue increíble! Quería hacerme fotos con mi madre y mi hermano y la idea de hacerlo a la vez que íbamos conociendo la ciudad me encantó. Chris fue muy divertida para pasear y sus fotos fueron tan increíbles que nos costó mucho elegir cuáles queríamos 😅. ¡Lo volvería a hacer sin duda si vuelvo a Oporto en el futuro!",
      fr: "Le tour photo que nous avons fait avec Chris était incroyable ! Je voulais faire des photos avec ma mère et mon frère, et l'idée de le faire en découvrant la ville m'a tout de suite emballée ! Chris a été super sympa pour se balader et ses photos étaient tellement géniales qu'on avait beaucoup de mal à choisir lesquelles garder 😅. Je referai ça sans hésiter si je reviens à Porto un jour !",
    },
  },
  {
    id: "41a05bf4-4ee2-46d6-b8b2-a64a0542c9f1",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Maria, acho que ainda não tens a noção de quão incrível és! Já vi o trabalho de muitos fotógrafos, mas cada uma das tuas fotos é uma obra-prima irrepetível. A tua visão de um plano e a tua capacidade de captar a emoção do momento são talento puro e não-corrompido — e isso não é dado a toda a gente. Estou tão feliz por te ter conhecido no meu caminho! Tornaste realidade um sonho antigo que tinha. Desejo que todos os teus sonhos se realizem da forma mais mágica!",
      de: "Maria, ich glaube, dir ist gar nicht ganz bewusst, wie unglaublich du bist! Ich habe schon die Arbeit vieler Fotograf:innen gesehen, aber jede einzelne deiner Aufnahmen ist ein unwiederholbares Meisterwerk. Dein Bildgefühl und deine Fähigkeit, Emotionen im richtigen Moment einzufangen, sind echtes, ungetrübtes Talent — das ist nicht jedem gegeben. Ich bin so froh, dich auf meinem Weg getroffen zu haben! Du hast einen lange gehegten Traum von mir wahr werden lassen. Ich wünsche dir, dass sich all deine Träume auf die magischste Weise erfüllen!",
      es: "Maria, ¡creo que aún no eres del todo consciente de lo increíble que eres! He visto el trabajo de muchos fotógrafos, pero cada una de tus fotos es una obra maestra irrepetible. Tu visión de un encuadre y tu capacidad de captar la emoción en el momento son talento puro y no contaminado — algo que no se le da a cualquiera. ¡Qué alegría haberte encontrado en mi camino! Hiciste realidad un sueño que tenía desde hacía mucho. ¡Te deseo que todos tus sueños se hagan realidad de la forma más mágica!",
      fr: "Maria, je crois que tu ne te rends pas vraiment compte à quel point tu es incroyable ! J'ai vu le travail de nombreux photographes, mais chacune de tes photos est un chef-d'œuvre irreproductible. Ta vision d'un cadrage et ta capacité à saisir l'émotion sur le moment sont du vrai talent, pur et intact — ce n'est pas donné à tout le monde. Je suis si heureuse de t'avoir rencontrée sur mon chemin ! Tu as réalisé un rêve que je portais depuis longtemps. Je te souhaite que tous tes rêves se réalisent de la manière la plus magique possible !",
    },
  },
  {
    id: "29205656-9af8-4f65-a9a8-8c5700aad17c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Maria, querida! Todas as fotos estão deslumbrantes! Como é que consegues captar a essência das coisas? Estou tão feliz por não nos termos assustado com a chuva e termos avançado com a sessão — muito obrigada! Foi tão fácil estar contigo, porque, sinceramente, não sei posar, e tu dás apoio, ambiente, e tudo simplesmente acaba lindo.",
      de: "Maria, meine Liebe! Alle Fotos sind atemberaubend! Wie schaffst du es, das Wesen der Dinge so einzufangen? Ich bin so froh, dass wir uns vom Regen nicht haben einschüchtern lassen und das Shooting durchgezogen haben — vielen Dank dafür! Mit dir war es so einfach, weil ich, ehrlich gesagt, nicht posieren kann, und du gibst Unterstützung, Stimmung, und am Ende wird einfach alles wunderschön.",
      es: "Maria, querida! Todas las fotos están impresionantes! ¿Cómo consigues captar la esencia de las cosas? Me alegro tanto de que no nos asustáramos con la lluvia y siguiéramos adelante con la sesión — ¡muchísimas gracias! Estar contigo fue muy fácil, porque la verdad es que no sé posar, y tú das apoyo, ambiente, y todo acaba quedando precioso.",
      fr: "Maria, ma chère ! Toutes les photos sont magnifiques ! Comment réussis-tu à saisir l'essence des choses ? Je suis tellement heureuse que nous ne nous soyons pas laissées arrêter par la pluie et que nous ayons quand même fait la séance — un grand merci ! C'était tellement simple d'être avec toi, parce qu'honnêtement, je ne sais pas poser, et toi tu donnes du soutien, de l'ambiance, et tout finit par être magnifique.",
    },
  },
  {
    id: "33a8db59-bf3f-40e0-8ebe-c5872c3a57a4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Meu Deus, tão lindas 😍 As de preto e branco partiram-me o coração. E a luz das que estão a cores está irreal. Aqui estou eu, suada depois do treino, e em vez de tomar duche estou a escolher fotos para um post 😄",
      de: "Mein Gott, so wunderschön 😍 Die in Schwarz-Weiß haben mir das Herz gebrochen. Und das Licht in den Farbfotos ist unwirklich. Ich sitze hier verschwitzt nach dem Training und gehe statt unter die Dusche lieber Fotos für einen Post auswählen 😄",
      es: "Madre mía, qué bonitas 😍 Las de blanco y negro me rompieron el corazón. Y la luz de las que están en color es irreal. Aquí estoy yo, sudada tras el entrenamiento, y en vez de ducharme estoy eligiendo fotos para un post 😄",
      fr: "Mon Dieu, qu'elles sont belles 😍 Les noir et blanc m'ont fendu le cœur. Et la lumière sur celles en couleur est irréelle. Me voilà, en sueur après l'entraînement, et au lieu de prendre une douche, je choisis des photos pour un post 😄",
    },
  },
  {
    id: "25d76d0f-3339-4a93-bfc8-6e3bf40dddcf",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tati, acabei de ver a sessão de família no computador do escritório e estou simplesmente a chorar à secretária. Estou tão feliz. Captaste emoções subtis e pequenos detalhes. Os avós vão ter uma recordação única destes dias de viagem. Obrigada, mesmo muito obrigada.",
      de: "Tati, ich habe mir gerade die Familienfotos auf dem Bürocomputer angesehen und sitze einfach am Schreibtisch und weine. Ich bin so glücklich. Du hast feine Emotionen und kleine Details festgehalten. Die Großeltern werden eine einzigartige Erinnerung an diese Reisetage bekommen. Danke, vielen, vielen Dank.",
      es: "Tati, acabo de ver la sesión familiar en el ordenador de la oficina y me he puesto a llorar en mi mesa. Estoy tan feliz. Captaste emociones muy sutiles y detalles pequeñitos. Los abuelos van a tener un recuerdo único de estos días de viaje. Gracias, muchísimas gracias.",
      fr: "Tati, je viens de voir la séance famille sur l'ordinateur du bureau et je pleure tout simplement à mon poste. Je suis tellement heureuse. Tu as capturé des émotions subtiles et de petits détails. Les grands-parents auront un souvenir unique de ces jours de voyage. Merci, vraiment merci.",
    },
  },
  {
    id: "c9ea6164-e6a6-4a4d-97c7-74e9feb67ed0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Kristina, muito obrigada — fotos tão lindas! E que passeio aquecedor para o coração. Muito obrigada!",
      de: "Kristina, vielen Dank — was für tolle Fotos! Und was für ein herzerwärmender Spaziergang. Tausend Dank!",
      es: "Kristina, muchísimas gracias — qué fotos tan bonitas! Y qué paseo más entrañable. ¡Mil gracias!",
      fr: "Kristina, merci beaucoup — quelles belles photos ! Et quelle balade qui réchauffe le cœur. Merci infiniment !",
    },
  },
  {
    id: "b2985c6b-70a5-40a1-a14c-fc8247c33ea6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "5 estrelas pelo trabalho e, sobretudo, pela paciência e simpatia. No caso dos concertos, é uma verdadeira mais-valia trabalhar com profissionais como o Sr. Rui Veloso, que conseguem perceber tão bem as nossas emoções e necessidades.",
      de: "5 Sterne für die Arbeit und vor allem für die Geduld und Freundlichkeit. Bei Konzerten ist es ein echter Vorteil, mit Profis wie Herrn Rui Veloso zu arbeiten, die unsere Emotionen und Bedürfnisse so gut verstehen.",
      es: "5 estrellas por el trabajo y, sobre todo, por la paciencia y la amabilidad. En el caso de los conciertos, es una verdadera ventaja trabajar con profesionales como el Sr. Rui Veloso, que entienden tan bien nuestras emociones y necesidades.",
      fr: "5 étoiles pour le travail et, surtout, pour la patience et la gentillesse. Pour les concerts, c'est un vrai atout de travailler avec des professionnels comme M. Rui Veloso, qui savent si bien comprendre nos émotions et nos besoins.",
    },
  },
  {
    id: "e557f3f5-32a7-45ab-9b68-a541e720d488",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uma experiência absolutamente maravilhosa 🙏 Como viajante essencialmente sozinha, ter alguém que me mostre os pontos locais e me ajude a tirar as fotos que imagino poupa-me o tempo e a complicação dos tripés, do equipamento, etc. Tão simpática e talentosa ✨ Mal posso esperar para ver as minhas fotos finais.",
      de: "Eine absolut wundervolle Erfahrung 🙏 Als Person, die meistens allein reist, ist es großartig, jemanden zu haben, der mir die lokalen Spots zeigt und mir hilft, genau die Fotos zu machen, die ich mir vorstelle — das spart Zeit und den Aufwand mit Stativen, Equipment usw. So freundlich und talentiert ✨ Ich kann es kaum erwarten, meine finalen Fotos zu sehen.",
      es: "Una experiencia absolutamente maravillosa 🙏 Como persona que viaja sobre todo sola, contar con alguien que me enseñe los rincones locales y me ayude a hacer las fotos que imagino me ahorra el tiempo y la complicación de los trípodes, equipo, etc. Tan amable y talentosa ✨ No puedo esperar para ver mis fotos finales.",
      fr: "Une expérience absolument merveilleuse 🙏 En tant que voyageuse principalement solo, avoir quelqu'un qui me montre les coins locaux et m'aide à prendre les photos que j'imagine m'évite le temps et la galère des trépieds, du matériel, etc. Tellement gentille et talentueuse ✨ J'ai hâte de voir mes photos finales.",
    },
  },
  {
    id: "8e6f80cd-2009-4018-a100-df8093312651",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não podíamos ter escolhido melhor fotógrafa para o batizado da nossa menina. Desde o primeiro momento sentimo-nos completamente à vontade, com uma simpatia e profissionalismo incríveis. Teve uma atenção fantástica ao detalhe e conseguiu captar exatamente aquilo que pedimos: momentos genuínos, cheios de emoção e significado. As fotografias ficaram lindas, naturais e cheias de luz. São memórias que vamos guardar para sempre. Recomendamos do fundo do coração! Obrigada por fazeres parte de um dia tão especial e importante para nós!",
      de: "Wir hätten keine bessere Fotografin für die Taufe unseres Mädchens wählen können. Von der ersten Minute an haben wir uns vollkommen wohlgefühlt — bei einer unglaublichen Freundlichkeit und Professionalität. Sie hatte einen fantastischen Sinn fürs Detail und hat genau das eingefangen, worum wir gebeten hatten: echte Momente, voller Emotion und Bedeutung. Die Fotos sind wunderschön geworden, natürlich und voller Licht. Erinnerungen, die wir für immer bewahren werden. Wir empfehlen sie von Herzen! Danke, dass du Teil eines so besonderen und wichtigen Tages für uns warst!",
      es: "No podríamos haber elegido mejor fotógrafa para el bautizo de nuestra niña. Desde el primer momento nos sentimos totalmente cómodos, con una amabilidad y profesionalidad increíbles. Tuvo una atención al detalle fantástica y consiguió captar exactamente lo que le pedimos: momentos genuinos, llenos de emoción y significado. Las fotos quedaron preciosas, naturales y llenas de luz. Son recuerdos que guardaremos para siempre. La recomendamos de corazón! ¡Gracias por formar parte de un día tan especial e importante para nosotros!",
      fr: "Nous n'aurions pas pu choisir meilleure photographe pour le baptême de notre petite fille. Dès le premier instant, nous nous sommes sentis totalement à l'aise, avec une gentillesse et un professionnalisme incroyables. Elle a eu une attention fantastique aux détails et a su capturer exactement ce que nous avions demandé : des moments authentiques, pleins d'émotion et de sens. Les photos sont magnifiques, naturelles et pleines de lumière. Ce sont des souvenirs que nous garderons à jamais. Nous la recommandons de tout cœur ! Merci d'avoir fait partie d'un jour si spécial et important pour nous !",
    },
  },
  {
    id: "fb190b26-cbc2-479c-ab4c-afc1d6e85aab",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Comprei uma das maravilhosas fotografias do Massimo, com vista para o oceano 🌊 Adoro tanto o trabalho dele e esta fotografia encontrou um lugar muito especial na nossa casa…",
      de: "Ich habe eines der wunderschönen Ozeanblick-Fotos von Massimo gekauft 🌊 Ich liebe seine Arbeit so sehr, und diese Fotografie hat einen ganz besonderen Platz in unserem Zuhause gefunden…",
      es: "Compré una de las maravillosas fotografías de Massimo con vista al océano 🌊 Adoro tanto su trabajo y esta fotografía ha encontrado un lugar muy especial en nuestra casa…",
      fr: "J'ai acheté l'une des magnifiques photos de Massimo avec vue sur l'océan 🌊 J'aime tellement son travail, et cette photographie a trouvé une place très spéciale dans notre maison…",
    },
  },
  {
    id: "d7054ffa-54f3-4240-8713-a1db20778ea4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Obrigada, Maria, pela atmosfera incrível, pelo apoio durante todo o processo e por tantas fotos espetaculares! Adoro todas!",
      de: "Danke, Maria, für die fantastische Atmosphäre, deine Unterstützung während des gesamten Prozesses und so viele großartige Fotos! Ich liebe alle!",
      es: "Gracias, Maria, por una atmósfera increíble, por el apoyo durante todo el proceso y por tantas fotos espectaculares. ¡Las amo todas!",
      fr: "Merci, Maria, pour cette ambiance incroyable, ton soutien tout au long du processus et tant de photos magnifiques ! Je les adore toutes !",
    },
  },
  {
    id: "2d0f17d6-7ce5-40ba-993e-e6d60b383d0a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Olá! Meu Deus, isto é tão bom — não estava nada à espera 🥺 Como é que criaste este milagre?! Muito obrigada 🙏 Lenaaa, já vi as fotos umas 100 vezes, ahaha. Está tão lindo!",
      de: "Hallo! Mein Gott, das ist so unglaublich gut — damit habe ich überhaupt nicht gerechnet 🥺 Wie hast du dieses Wunder erschaffen?! Vielen, vielen Dank 🙏 Lenaaa, ich habe sie mir schon 100-mal angesehen, hahaha. Es ist so wunderschön!",
      es: "¡Hola! Madre mía, esto está tan bien que no me lo esperaba 🥺 ¿¡Cómo hiciste este milagro!? Muchísimas gracias 🙏 Lenaaa, ya las he mirado 100 veces, jaja. ¡Está precioso!",
      fr: "Coucou ! Mon Dieu, c'est tellement génial — je ne m'y attendais pas du tout 🥺 Comment as-tu créé ce miracle ?! Merci beaucoup 🙏 Lenaaa, je les ai déjà regardées 100 fois, haha. C'est tellement beau !",
    },
  },
  {
    id: "3c02d37c-f7a9-4cea-b9e0-933b5b91d3c7",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ola, muito obrigada pela sessão fotográfica em Lisboa — adorámos. As fotos estão cheias de emoção, parecem muito naturais e a luz está mesmo bonita. Cada plano parece especial. Sentimo-nos muito confortáveis e completamente nós próprios durante a sessão, e isso nota-se mesmo nas fotos. Estas imagens significam imenso para nós e vão ser algo a que voltaremos durante muitos anos ✨📸 Muito obrigada outra vez, foi um prazer trabalhar contigo 🤍",
      de: "Ola, vielen Dank für das Foto-Shooting in Lissabon — wir haben es geliebt. Die Fotos sind voller Emotion, wirken sehr natürlich, und das Licht ist einfach wunderschön. Jede Aufnahme fühlt sich besonders an. Wir haben uns während des Shootings absolut wohl und ganz wir selbst gefühlt, und das sieht man den Bildern wirklich an. Diese Fotos bedeuten uns sehr viel und werden etwas sein, zu dem wir noch über viele Jahre hinweg zurückkehren ✨📸 Nochmals vielen Dank, es war ein Vergnügen, mit dir zu arbeiten 🤍",
      es: "Ola, muchísimas gracias por la sesión en Lisboa — nos encantó. Las fotos están llenas de emoción, se sienten muy naturales y la luz es preciosa. Cada toma parece especial. Nos sentimos muy cómodos y completamente nosotros mismos durante la sesión, y eso se nota en las fotos. Estas imágenes significan muchísimo para nosotros y serán algo a lo que volveremos durante muchos años ✨📸 Mil gracias de nuevo, ha sido un placer trabajar contigo 🤍",
      fr: "Ola, merci beaucoup pour la séance photo à Lisbonne — nous avons adoré. Les photos sont pleines d'émotion, elles ont l'air très naturelles et la lumière est tout simplement magnifique. Chaque cliché paraît spécial. Nous nous sommes sentis très à l'aise et complètement nous-mêmes pendant la séance, et cela se voit vraiment sur les photos. Ces images signifient énormément pour nous et seront quelque chose vers quoi nous reviendrons pendant de nombreuses années ✨📸 Merci encore, c'était un plaisir de travailler avec toi 🤍",
    },
  },
  {
    id: "c9406e84-6cc9-4ea5-ad53-3fa168fe86fe",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei a experiência!! 🩷",
      de: "Ich habe die Erfahrung geliebt!! 🩷",
      es: "¡¡Me encantó la experiencia!! 🩷",
      fr: "J'ai adoré l'expérience !! 🩷",
    },
  },
  {
    id: "1da3cf11-7428-46fb-89b3-7ec992217e5e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos uma sessão fotográfica ao pôr do sol no Castelo de São Jorge, em Lisboa, e adorámos. Tivemos uma ótima sessão com a Viktoria. Muito obrigado pela tua paciência e por passares tempo com a minha família, eternizando momentos inesquecíveis.",
      de: "Wir hatten ein Sonnenuntergangs-Shooting am Castelo de São Jorge in Lissabon, und wir haben es geliebt. Wir hatten eine wundervolle Session mit Viktoria. Vielen Dank für deine Geduld und dafür, dass du mit meiner Familie unvergessliche Momente verewigt hast.",
      es: "Tuvimos una sesión fotográfica al atardecer en el Castelo de São Jorge, en Lisboa, y nos encantó. Disfrutamos de una sesión genial con Viktoria. Muchas gracias por tu paciencia y por pasar tiempo con mi familia, inmortalizando momentos inolvidables.",
      fr: "Nous avons fait une séance photo au coucher du soleil au Castelo de São Jorge, à Lisbonne, et nous avons adoré. Nous avons passé un super moment avec Viktoria. Merci beaucoup pour ta patience et pour avoir passé du temps avec ma famille, en immortalisant des moments inoubliables.",
    },
  },
  {
    id: "185d9c60-46c4-4497-8c26-5eae5a058b2f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalhámos recentemente com a Cindy durante o \"mother blessing\" da minha amiga e não podíamos estar mais felizes com o resultado. Era um cenário muito íntimo e pessoal, mas a Cindy conseguiu mover-se nesse espaço de forma maravilhosa. Estava quase invisível e, ainda assim, captou cada momento significativo sem qualquer esforço aparente. As fotos não são apenas deslumbrantes — sentem-se mesmo vivas. Sempre que olhamos para elas, somos imediatamente levadas de volta àquele momento especial. Isso diz tudo sobre o seu talento e sensibilidade. Sem dúvida recomendada se procuras uma fotógrafa que consiga captar momentos de forma natural e subtil.",
      de: "Wir haben kürzlich mit Cindy beim „Mother Blessing\" meiner Freundin zusammengearbeitet und könnten mit dem Ergebnis nicht zufriedener sein. Es war ein sehr intimes, persönliches Setting, doch Cindy hat sich darin auf wunderbare Weise bewegt. Sie war fast unsichtbar und hat trotzdem jeden bedeutsamen Moment scheinbar mühelos eingefangen. Die Fotos sind nicht nur atemberaubend, sie fühlen sich wirklich lebendig an. Jedes Mal, wenn wir sie ansehen, werden wir sofort in diesen besonderen Moment zurückversetzt. Das sagt alles über ihr Talent und ihre Sensibilität. Definitiv zu empfehlen, wenn du eine Fotografin suchst, die Momente natürlich und subtil einfängt.",
      es: "Trabajamos recientemente con Cindy durante el \"mother blessing\" de mi amiga y no podríamos estar más contentos con el resultado. Era un escenario muy íntimo y personal, pero Cindy supo moverse en ese espacio de una forma maravillosa. Estaba casi invisible y, aun así, captó cada momento significativo sin ningún esfuerzo aparente. Las fotos no solo son impresionantes, también se sienten vivas. Cada vez que las miramos, volvemos al instante a ese momento especial. Eso lo dice todo sobre su talento y sensibilidad. Sin duda recomendada si buscas a una fotógrafa que capte momentos de forma natural y sutil.",
      fr: "Nous avons récemment travaillé avec Cindy lors du « mother blessing » de mon amie et nous ne pourrions pas être plus heureux du résultat. C'était un cadre très intime et personnel, mais Cindy a su évoluer dans cet espace avec beaucoup de finesse. Elle était presque invisible et a pourtant capturé chaque moment significatif sans aucun effort apparent. Les photos ne sont pas seulement magnifiques, elles semblent vraiment vivantes. Chaque fois que nous les regardons, nous sommes immédiatement replongés dans ce moment spécial. Cela dit tout sur son talent et sa sensibilité. Vivement recommandée si vous cherchez une photographe capable de capturer les moments de manière naturelle et subtile.",
    },
  },
  {
    id: "b079aed2-8da1-47bc-89be-be52443121a0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei todo o trabalho, dedicação e simpatia do Sr. José. O cenário estava lindo e as fotos ficaram maravilhosas. Sem dúvida, um trabalho espetacular. Muito obrigada!",
      de: "Ich habe die ganze Arbeit, das Engagement und die Freundlichkeit von Herrn José geliebt. Das Setting war wunderschön und die Fotos sind einfach traumhaft geworden. Ohne Zweifel eine spektakuläre Arbeit. Vielen Dank!",
      es: "Me encantó todo el trabajo, la dedicación y la simpatía del Sr. José. El escenario era precioso y las fotos quedaron maravillosas. Sin duda, un trabajo espectacular. ¡Mil gracias!",
      fr: "J'ai adoré tout le travail, le dévouement et la gentillesse de M. José. Le décor était magnifique et les photos sont superbes. Sans aucun doute, un travail spectaculaire. Merci beaucoup !",
    },
  },
  {
    id: "74ceb277-7d9c-4bde-94b6-216694054cc2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Muito obrigada pelas fotos, Maria — adoramos! Ficaram ótimas. Pedimos desculpa também pela má condução 😂",
      de: "Vielen Dank für die Fotos, Maria — wir lieben sie! Sie sind großartig geworden. Entschuldigung auch für die schlechte Fahrweise 😂",
      es: "¡Muchísimas gracias por las fotos, Maria — nos encantan! Quedaron geniales. Y perdón también por la mala conducción 😂",
      fr: "Merci beaucoup pour les photos, Maria — nous les adorons ! Elles sont superbes. Excuse-nous aussi pour la mauvaise conduite 😂",
    },
  },
  {
    id: "213114fc-abbd-420a-aef2-026d3ed82f87",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Leeenaaa!!! Muito obrigada!!! Ficámos tão bonitas contigo 😍😍😍 Se for preciso escrever uma avaliação algures (no site, no Google), diz-me. Obrigada por entregares tudo tão depressa!!!",
      de: "Leeenaaa!!! Vielen, vielen Dank!!! Wir sehen mit dir so hübsch aus 😍😍😍 Falls ich irgendwo eine Bewertung schreiben soll (Website, Google), sag einfach Bescheid. Danke, dass du alles so schnell geliefert hast!!!",
      es: "¡¡Leeenaaa!!! ¡¡Muchísimas gracias!! ¡¡Salimos tan guapas contigo!! 😍😍😍 Si tengo que escribir una reseña en algún sitio (la web, Google), dímelo. ¡Gracias por entregarlo todo tan rápido!",
      fr: "Leeenaaa !!! Merci beaucoup !!! Nous sommes tellement belles avec toi 😍😍😍 S'il faut que j'écrive un avis quelque part (le site, Google), dis-le-moi. Merci d'avoir tout livré aussi vite !!!",
    },
  },
  {
    id: "2d61bba3-adb6-40f7-b676-065030239c74",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uau, nem sei como te agradecer por tantas fotos maravilhosas! Do fundo do coração, obrigada por todo o esforço, dedicação e cuidado que puseste na nossa sessão. Vou de certeza recomendar-te a toda a gente! Obrigada, Tati, adorámos cada foto — és incrível, e sempre que fizermos novas fotos vai ser de certeza contigo! Obrigada, obrigada 🥰",
      de: "Wow, ich weiß gar nicht, wie ich dir für so viele wundervolle Fotos danken soll! Von ganzem Herzen vielen Dank für all die Mühe, das Engagement und die Sorgfalt, die du in unser Shooting gesteckt hast. Ich werde dich auf jeden Fall jedem empfehlen! Danke, Tati, wir haben jedes einzelne Foto geliebt — du bist großartig, und wann immer wir wieder neue Fotos machen, dann ganz sicher mit dir! Danke, danke 🥰",
      es: "¡Guau, no sé cómo agradecerte tantas fotos maravillosas! Desde el fondo de mi corazón, gracias por todo el esfuerzo, dedicación y cariño que pusiste en nuestra sesión. Sin duda te recomendaré a todo el mundo. Gracias, Tati, adoramos cada foto — eres increíble, y cuando hagamos fotos nuevas, ¡seguro que será contigo otra vez! Gracias, gracias 🥰",
      fr: "Wow, je ne sais même pas comment te remercier pour autant de photos merveilleuses ! Du fond du cœur, merci pour tous les efforts, le dévouement et l'attention que tu as mis dans notre séance. Je te recommanderai sans hésiter à tout le monde ! Merci, Tati, nous avons adoré chaque photo — tu es incroyable, et chaque fois que nous referons des photos, ce sera sans aucun doute avec toi ! Merci, merci 🥰",
    },
  },
  {
    id: "ff722975-a947-46fb-8271-012921a9eca5",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorámos! A Débora deixou-nos completamente à vontade e deu-nos dicas fantásticas para nos soltarmos. O tempo passou a voar e passámos a sessão inteira a rir. Valeu mesmo a pena, e voltávamos a fazê-lo tudo outra vez! Obrigada por toda a tua simpatia e calor humano!",
      de: "Wir haben es geliebt! Débora hat uns absolut entspannen lassen und uns fantastische Tipps gegeben, wie wir uns gehen lassen. Die Zeit ist nur so verflogen und wir haben die ganze Session über gelacht. Es hat sich absolut gelohnt, und wir würden es jederzeit wieder machen! Danke für all deine Freundlichkeit und Wärme!",
      es: "¡Nos encantó! Débora nos hizo sentir totalmente cómodos y nos dio consejos fantásticos para soltarnos. El tiempo voló y nos pasamos toda la sesión riéndonos. Mereció totalmente la pena, ¡lo volveríamos a hacer todo otra vez! Gracias por toda tu amabilidad y calidez.",
      fr: "Nous avons adoré ! Débora nous a complètement mis à l'aise et nous a donné de super conseils pour nous lâcher. Le temps a filé et nous avons passé toute la séance à rire. Cela en valait absolument la peine, et nous le referions tout pareil ! Merci pour toute ta gentillesse et ta chaleur !",
    },
  },
  {
    id: "05d909d4-2a02-47c2-9c75-ce1b628b63ed",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Continuo a distrair-me do trabalho porque volto às fotos — fazem-me tão feliz. Obrigada outra vez! Não esperava que conseguisses captar tão na perfeição o ambiente alegre da nossa família neste dia. Estamos muito raramente todos juntos e tu conseguiste apanhar tudo isso. É mesmo impagável.",
      de: "Ich lasse mich ständig von der Arbeit ablenken, weil ich immer wieder zu den Fotos zurückkehre — sie machen mich so glücklich. Nochmals vielen Dank! Ich habe nicht erwartet, dass du die fröhliche Familienatmosphäre an unserem Tag so perfekt einfangen würdest. Wir sind nur sehr selten alle zusammen, und du hast all das aufgefangen. Das ist wirklich unbezahlbar.",
      es: "Sigo distraída del trabajo porque vuelvo una y otra vez a las fotos — me hacen tan feliz. ¡Mil gracias otra vez! No esperaba que captaras tan a la perfección el ambiente alegre de nuestra familia ese día. Estamos muy pocas veces todos juntos y conseguiste capturar todo eso. De verdad no tiene precio.",
      fr: "Je n'arrête pas de me déconcentrer du travail parce que je reviens regarder les photos — elles me rendent tellement heureuse. Merci encore ! Je ne m'attendais pas à ce que tu captures aussi parfaitement l'atmosphère joyeuse et familiale de notre journée. Nous sommes très rarement tous réunis, et tu as réussi à tout saisir. C'est vraiment inestimable.",
    },
  },
  {
    id: "983df4d1-1632-4889-af28-d07eb0352acf",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Estamos imensamente gratos e tão felizes — que fotos lindas, cheias de história e significado. Ficaram incríveis, cada uma a transmitir uma emoção diferente. O Thiago está muito grato e disse que as fotos, a edição e a forma como a Giovana conduziu a sessão (o que para ele, sendo super tímido, foi uma grande coisa) foram absolutamente brilhantes.\n\nQue Deus abençoe o teu trabalho e que mais famílias sejam alcançadas pelo teu dom. Vamos ter muito gosto em recomendar-te com confiança a quem precise de captar momentos tão importantes. 💕",
      de: "Wir sind unglaublich dankbar und so glücklich — was für wunderschöne Fotos, voller Geschichte und Bedeutung. Sie sind großartig geworden, jedes einzelne mit einer anderen Emotion. Thiago ist so dankbar und hat gesagt, dass die Fotos, die Bearbeitung und die Art, wie Giovana die Session geleitet hat (was für ihn, der super schüchtern ist, eine große Sache war), absolut brillant waren.\n\nGott segne deine Arbeit, und mögen noch mehr Familien durch dein Talent erreicht werden. Wir werden dich mit Freude und ohne zu zögern allen empfehlen, die solche wichtigen Momente festhalten möchten. 💕",
      es: "Estamos inmensamente agradecidos y tan felices — qué fotos tan bonitas, llenas de historia y de significado. Quedaron increíbles, cada una transmite una emoción diferente. Thiago está muy agradecido y dijo que las fotos, la edición y la forma en que Giovana condujo la sesión (lo cual para él, siendo súper tímido, fue muy importante) fueron absolutamente brillantes.\n\nQue Dios bendiga tu trabajo y que más familias puedan disfrutar de tu don. Te recomendaremos con muchísima confianza a cualquiera que necesite captar momentos tan importantes. 💕",
      fr: "Nous sommes immensément reconnaissants et si heureux — quelles belles photos, pleines d'histoire et de sens. Elles sont incroyables, chacune transmettant une émotion différente. Thiago est très reconnaissant et a dit que les photos, le traitement et la manière dont Giovana a mené la séance (ce qui, pour lui, qui est super timide, était une grande chose) étaient absolument brillants.\n\nQue Dieu bénisse ton travail et que d'autres familles puissent profiter de ton don. Nous serons heureux de te recommander en toute confiance à toute personne ayant besoin de capturer des moments aussi importants. 💕",
    },
  },
  {
    id: "e8b86250-e07d-4e5d-8dcb-babd186d245b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Equipa jovem e criativa! Uma equipa alegre, com um trabalho incrível e, sem dúvida, muito profissional. Muito atentos aos detalhes e aos pedidos do casal. Fotos que captam a beleza e o amor de uma forma tão bonita. Adorei o resultado.",
      de: "Junges und kreatives Team! Ein fröhliches Team mit unglaublicher Arbeit und ohne Zweifel sehr professionell. Sehr aufmerksam für Details und für die Wünsche des Brautpaars. Fotos, die Schönheit und Liebe auf eine so wunderbare Weise einfangen. Ich habe das Ergebnis geliebt.",
      es: "¡Equipo joven y creativo! Un equipo alegre, con un trabajo increíble y, sin duda, muy profesional. Muy atentos a los detalles y a las peticiones de la pareja. Fotos que captan la belleza y el amor de una forma tan bonita. Me encantó el resultado.",
      fr: "Une équipe jeune et créative ! Une équipe joyeuse, avec un travail incroyable et, sans aucun doute, très professionnelle. Très attentifs aux détails et aux demandes du couple. Des photos qui capturent la beauté et l'amour de manière magnifique. J'ai adoré le résultat.",
    },
  },
  {
    id: "8f2fafb9-5c0e-41fc-93d2-48acf37c3e7f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Desde o primeiro contacto foram super profissionais e disponíveis. Perceberam exatamente o que queríamos e estiveram sempre atentos a cada detalhe ao longo do dia. O resultado final superou as nossas expectativas — fotografias naturais, cheias de emoção e com uma elegância única. Captaram momentos genuínos de forma discreta e linda. Ficámos mesmo felizes com tudo. Recomendamos sem hesitar! 💯🙏",
      de: "Vom ersten Kontakt an waren sie super professionell und erreichbar. Sie haben genau verstanden, was wir wollten, und waren den ganzen Tag über stets auf jedes Detail bedacht. Das Endergebnis hat unsere Erwartungen übertroffen — natürliche Fotos voller Emotion und mit einer einzigartigen Eleganz. Sie haben echte Momente auf eine dezente und wunderschöne Weise eingefangen. Wir sind mit allem wirklich glücklich. Wir empfehlen sie ohne zu zögern! 💯🙏",
      es: "Desde el primer contacto fueron súper profesionales y atentos. Entendieron exactamente lo que queríamos y estuvieron siempre pendientes de cada detalle durante todo el día. El resultado final superó nuestras expectativas — fotografías naturales, llenas de emoción y con una elegancia única. Captaron momentos genuinos de forma discreta y preciosa. De verdad quedamos muy felices con todo. Los recomendamos sin dudarlo! 💯🙏",
      fr: "Dès le premier contact, ils ont été super professionnels et disponibles. Ils ont parfaitement compris ce que nous voulions et ont toujours été attentifs à chaque détail tout au long de la journée. Le résultat final a dépassé nos attentes — des photographies naturelles, pleines d'émotion et d'une élégance unique. Ils ont capturé des moments authentiques de façon discrète et magnifique. Nous avons vraiment été très heureux de tout. Nous les recommandons sans aucune hésitation ! 💯🙏",
    },
  },
  {
    id: "ac7b7027-6bdd-43fb-a70a-8b5c384c9251",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Só posso recomendar o Massimo: grande profissional, com um conhecimento profundo dos melhores spots do Algarve.",
      de: "Ich kann Massimo nur empfehlen — ein toller Profi mit fundiertem Wissen über die besten Spots der Algarve.",
      es: "Solo puedo recomendar a Massimo: gran profesional, con un profundo conocimiento de los mejores rincones del Algarve.",
      fr: "Je ne peux que recommander Massimo, grand professionnel et grand connaisseur des meilleurs spots de l'Algarve.",
    },
  },
  {
    id: "5026a05d-83a4-43fc-beca-b7f3df92550c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos uma experiência fantástica com o Massimo como nosso fotógrafo de família no Algarve! O nosso grupo era bastante grande: 8 adultos e 8 crianças, mas ele geriu tudo com facilidade, paciência e muito bom humor.\nFez com que toda a gente se sentisse confortável, especialmente as crianças, e captou momentos lindos e naturais sem que nada parecesse forçado. As fotos estão deslumbrantes e refletem mesmo a alegria do nosso tempo juntos. Também nos deu ótimas recomendações de praias locais, o que tornou toda a experiência ainda melhor.\nRecomendo vivamente o Massimo para grupos familiares grandes — fez com que tudo parecesse fácil e divertido!",
      de: "Wir hatten eine fantastische Erfahrung mit Massimo als unserem Familienfotografen an der Algarve! Unsere Gruppe war ziemlich groß: 8 Erwachsene und 8 Kinder, aber er hat alles mit Leichtigkeit, Geduld und einer großen Portion Humor gemeistert.\nEr hat dafür gesorgt, dass sich alle wohlfühlten, besonders die Kinder, und wunderschöne, natürliche Momente eingefangen, ohne dass etwas gestellt wirkte. Die Fotos sind atemberaubend und spiegeln wirklich die Freude unserer gemeinsamen Zeit wider. Außerdem hat er uns tolle Tipps für lokale Strände gegeben, was die ganze Erfahrung noch besser gemacht hat.\nIch kann Massimo für große Familiengruppen wärmstens empfehlen — er hat es leicht und spaßig gemacht!",
      es: "Tuvimos una experiencia fantástica con Massimo como fotógrafo de familia en el Algarve! Nuestro grupo era bastante grande: 8 adultos y 8 niños, pero lo manejó todo con facilidad, paciencia y mucho sentido del humor.\nHizo que todo el mundo se sintiera cómodo, especialmente los niños, y captó momentos preciosos y naturales sin que nada pareciera forzado. Las fotos son impresionantes y reflejan de verdad la alegría de nuestro tiempo juntos. También nos dio excelentes recomendaciones de playas locales, lo que hizo que toda la experiencia fuera aún mejor.\nRecomiendo muchísimo a Massimo para grupos familiares grandes — ¡lo hizo todo fácil y divertido!",
      fr: "Nous avons vécu une expérience fantastique avec Massimo en tant que photographe de famille en Algarve ! Notre groupe était assez grand : 8 adultes et 8 enfants, mais il a tout géré avec aisance, patience et un grand sens de l'humour.\nIl a mis tout le monde à l'aise, en particulier les enfants, et a capturé de beaux moments naturels sans que rien ne paraisse forcé. Les photos sont magnifiques et reflètent vraiment la joie de notre temps ensemble. Il nous a aussi donné d'excellentes recommandations de plages locales, ce qui a rendu toute l'expérience encore meilleure.\nJe recommande vivement Massimo pour les grands groupes familiaux — il a rendu tout cela facile et amusant !",
    },
  },
  {
    id: "bea48372-721c-4055-9ed6-311dcb8e7ab7",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Para além de muito profissional, a Chris é também uma pessoa maravilhosa, que enche o nosso coração de alegria! Todas as sessões fotográficas superaram as expectativas! A Chris tem um dom para nos pôr à vontade e é super paciente, carinhosa e criativa! Recomendo vivamente!!",
      de: "Chris ist nicht nur sehr professionell, sondern auch ein wundervoller Mensch, der unser Herz mit Freude erfüllt! Alle Foto-Shootings haben unsere Erwartungen übertroffen! Chris hat ein Talent dafür, uns entspannen zu lassen, und ist super geduldig, liebevoll und kreativ! Sehr zu empfehlen!!",
      es: "¡Además de muy profesional, Chris también es una persona maravillosa que nos llena el corazón de alegría! ¡Todas las sesiones superaron las expectativas! Chris tiene un don para ponerte cómoda y es súper paciente, cariñosa y creativa. ¡La recomiendo muchísimo!",
      fr: "En plus d'être très professionnelle, Chris est aussi une personne merveilleuse qui remplit notre cœur de joie ! Toutes les séances ont dépassé nos attentes ! Chris a un don pour nous mettre à l'aise et est super patiente, attentionnée et créative ! Je la recommande vivement !!",
    },
  },
  {
    id: "af1d0f09-4907-424e-9429-9b5e13503de1",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Massimo fotografou a minha família em Lagos, Portugal.\nFoi muito rápido a responder ao nosso pedido e as fotos que trouxemos para casa daquele dia de praia estão incríveis. Muito paciente com as crianças e rápido a entregar as fotos. Obrigada — até à próxima época.",
      de: "Massimo hat meine Familie in Lagos, Portugal, fotografiert.\nEr hat extrem schnell auf unsere Anfrage geantwortet, und die Fotos, die wir von diesem Strandtag mit nach Hause genommen haben, sind großartig. Sehr geduldig mit den Kindern und schnell bei der Lieferung der Fotos. Danke — bis zur nächsten Saison.",
      es: "Massimo le hizo fotos a mi familia en Lagos, Portugal.\nFue muy rápido respondiendo a nuestra consulta y las fotos que nos llevamos a casa de aquel día de playa son increíbles. Muy paciente con los niños y rápido entregando las fotos. Gracias — hasta la próxima temporada.",
      fr: "Massimo a photographié ma famille à Lagos, au Portugal.\nIl a été très rapide à répondre à notre demande et les photos que nous avons rapportées de cette journée à la plage sont magnifiques. Très patient avec les enfants et rapide pour la livraison des photos. Merci — à la prochaine saison.",
    },
  },
  {
    id: "c9588c2a-696d-4b6e-9446-89d3e7b0c018",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos uma sessão de maternidade com a Isa. Foi muito bem organizada e agradável. A Isa sugeriu alguns locais e ajudou-nos com as poses ao longo de toda a sessão. Estamos muito felizes com o trabalho dela e com as fotos que tirou, e recomendamos muito a Isa. Obrigada pela sessão incrível.",
      de: "Wir hatten ein Babybauch-Shooting mit Isa. Es war sehr gut organisiert und sehr angenehm. Isa hat einige Locations vorgeschlagen und uns während des gesamten Shootings beim Posieren geholfen. Wir sind mit ihrer Arbeit und den Fotos, die sie gemacht hat, sehr zufrieden und empfehlen Isa wärmstens. Danke für das tolle Shooting.",
      es: "Tuvimos una sesión de maternidad con Isa. Estuvo muy bien organizada y fue muy agradable. Isa nos sugirió algunas localizaciones y nos ayudó con las poses durante toda la sesión. Estamos muy contentos con su trabajo y con las fotos que hizo, y recomendamos mucho a Isa. Gracias por una sesión increíble.",
      fr: "Nous avons fait une séance grossesse avec Isa. C'était très bien organisé et très agréable. Isa nous a suggéré quelques lieux et nous a aidés avec les poses tout au long de la séance. Nous sommes très heureux de son travail et des photos qu'elle a prises, et nous recommandons vivement Isa. Merci pour cette superbe séance.",
    },
  },
  {
    id: "3c60ec21-c68a-462f-8fe0-be6119643b7b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Pedimos à Isa para fazer uma sessão fotográfica com toda a família (avós, filhos, netos). As fotos estão absolutamente deslumbrantes. Teve ideias ótimas e conseguiu pôr o meu menino a rir em todas as fotos (apesar de ele ter feito uma birra das grandes mesmo antes). Estamos super felizes com o resultado. É uma fotógrafa muito talentosa!",
      de: "Wir haben Isa gebeten, ein Fotoshooting mit der ganzen Familie zu machen (Großeltern, Kinder, Enkelkinder). Die Fotos sind absolut atemberaubend. Sie hatte tolle Ideen und hat es geschafft, meinen Kleinen in jedem Bild zum Lachen zu bringen (obwohl er kurz davor einen riesigen Wutanfall hatte). Wir sind super glücklich mit dem Ergebnis. Sie ist eine sehr talentierte Fotografin!",
      es: "Le pedimos a Isa que hiciera una sesión con toda la familia (abuelos, hijos, nietos). Las fotos están absolutamente impresionantes. Tuvo ideas geniales y consiguió que mi pequeñín se riera en cada foto (a pesar de que justo antes había tenido una rabieta enorme). Estamos súper felices con el resultado. ¡Es una fotógrafa con muchísimo talento!",
      fr: "Nous avons demandé à Isa de faire une séance photo avec toute la famille (grands-parents, enfants, petits-enfants). Les photos sont absolument magnifiques. Elle a eu de super idées et a réussi à faire rire mon tout-petit sur chaque photo (alors qu'il venait de faire une énorme crise juste avant). Nous sommes super heureux du résultat. C'est une photographe très talentueuse !",
    },
  },
  {
    id: "241a3ff5-373d-414d-a715-2bec0b9c350f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Marquem com o Massimo! Antes de mais, é um fotógrafo incrivelmente talentoso. Tivemos um dia muito ventoso na praia e ele não só nos deu boas indicações criativas, como conseguiu captar tanto a beleza do cenário como o melhor da nossa família. Em segundo lugar, temos uma menina de 2 anos super ativa, que não conseguia parar de correr na praia. O Massimo foi tão querido e paciente com ela, foi brincalhão e conseguiu obter imensos sorrisos enormes e até captar a alegria espontânea do momento. Por fim, foi tão simpático, atento e fácil de trabalhar. Adoramos as nossas fotos lindas e voltaríamos a marcar com ele sem pensar duas vezes!",
      de: "Bucht Massimo! Erstens ist er ein unglaublich talentierter Fotograf. Wir hatten einen sehr windigen Tag am Strand, und er hat uns nicht nur hilfreiche kreative Anweisungen gegeben, sondern es geschafft, sowohl die Schönheit des Ortes als auch das Beste unserer Familie einzufangen. Zweitens haben wir eine 2-jährige Tochter, die super aktiv ist und nicht aufhören konnte, am Strand herumzurennen. Massimo war so lieb und geduldig mit ihr, er war verspielt und hat es geschafft, viele große Lächeln und sogar die spontane Freude des Augenblicks einzufangen. Außerdem war er sehr nett, reaktionsschnell und unkompliziert. Wir lieben unsere wunderschönen Fotos und würden ohne zu zögern wieder mit ihm buchen!",
      es: "¡Reserva con Massimo! En primer lugar, es un fotógrafo con un talento increíble. Tuvimos un día muy ventoso en la playa y no solo nos dio una dirección creativa muy útil, sino que consiguió captar la belleza del escenario y lo mejor de nuestra familia. En segundo lugar, tenemos una niña de 2 años súper activa que no podía dejar de correr por la playa. Massimo fue muy dulce y paciente con ella, fue divertido y consiguió un montón de sonrisas enormes e incluso captar la diversión espontánea del momento. Por último, fue muy amable, atento y fácil de trabajar. Nos encantan nuestras preciosas fotos y volveríamos a reservar con él sin pensarlo!",
      fr: "Réservez avec Massimo ! Tout d'abord, c'est un photographe incroyablement talentueux. Nous avons eu une journée très venteuse sur la plage, et non seulement il nous a donné des indications créatives utiles, mais il a su capturer à la fois la beauté du décor et le meilleur de notre famille. Deuxièmement, nous avons une petite fille de 2 ans très active qui ne pouvait pas s'empêcher de courir partout sur la plage. Massimo a été si adorable et patient avec elle, il a été ludique et a réussi à capturer plein de grands sourires et même la joie spontanée du moment. Enfin, il a été très gentil, réactif et facile à vivre. Nous adorons nos magnifiques photos et nous le rebookerions sans hésiter !",
    },
  },
  {
    id: "11972c19-601f-4696-8e40-41bdae8c21c4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Passámos um momento incrível na nossa sessão fotográfica na Praia do Guincho. O tema do pedido de casamento ao pôr do sol fez com que tudo parecesse muito especial e natural — nada encenado nem forçado.\n\nO fotógrafo deixou-nos super à vontade desde o início, o que sinceramente fez toda a diferença. Pudemos ser nós próprios e aproveitar o momento, e isso nota-se mesmo nas fotos. Tudo pareceu fácil e descontraído.\n\nNo fim, não foram só as fotos (que ficaram lindas), foi a experiência toda. Gostámos genuinamente e recomendamos sem dúvida a quem queira captar algo significativo num lugar destes.",
      de: "Wir hatten eine wunderschöne Zeit beim Fotoshooting am Praia do Guincho. Das Thema des Antrags bei Sonnenuntergang hat alles sehr besonders und natürlich wirken lassen — überhaupt nicht inszeniert oder erzwungen.\n\nDer Fotograf hat uns von Anfang an total entspannen lassen, was ehrlich gesagt einen riesigen Unterschied gemacht hat. Wir konnten einfach wir selbst sein und den Moment genießen, und das sieht man auch in den Fotos. Alles fühlte sich locker und ungezwungen an.\n\nAm Ende waren es nicht nur die Fotos (die wunderschön geworden sind), sondern das gesamte Erlebnis. Wir haben es wirklich genossen und können es allen empfehlen, die etwas Bedeutsames an einem solchen Ort festhalten möchten.",
      es: "Pasamos un momento increíble en nuestra sesión en la Praia do Guincho. La temática de la pedida al atardecer hizo que todo se sintiera muy especial y natural — nada montado ni forzado.\n\nEl fotógrafo nos hizo sentir súper cómodos desde el principio, lo cual sinceramente marcó una gran diferencia. Pudimos ser nosotros mismos y disfrutar del momento, y eso de verdad se nota en las fotos. Todo se sintió fácil y relajado.\n\nAl final, no fue solo cuestión de las fotos (que quedaron preciosas), fue toda la experiencia. La disfrutamos de verdad y la recomendaríamos sin duda a cualquiera que quiera captar algo significativo en un lugar así.",
      fr: "Nous avons passé un moment incroyable lors de notre séance photo à la Praia do Guincho. Le thème de la demande au coucher du soleil a rendu tout cela vraiment spécial et naturel — rien de mis en scène ni de forcé.\n\nLe photographe nous a mis super à l'aise dès le début, ce qui, honnêtement, a fait toute la différence. Nous avons pu être nous-mêmes et profiter du moment, et cela se ressent vraiment sur les photos. Tout a été simple et détendu.\n\nAu final, ce n'était pas seulement une question de photos (qui sont magnifiques), c'était toute l'expérience. Nous l'avons sincèrement appréciée et nous la recommandons sans aucun doute à toute personne souhaitant capturer quelque chose de significatif dans un lieu comme celui-ci.",
    },
  },
  {
    id: "8caeb2e4-5b21-4a21-bd13-16fad1e85f13",
    title: {
      pt: "Experiência perfeita com uma fotógrafa talentosa",
      de: "Perfekte Erfahrung mit einer talentierten Fotografin",
      es: "Experiencia perfecta con una fotógrafa con talento",
      fr: "Expérience parfaite avec une photographe talentueuse",
    },
    text: {
      pt: "Tivemos uma experiência excecional com a fotógrafa Kate Belova em Lisboa.\n\nDesde o início, tudo foi conduzido na perfeição. A Kate chegou a horas e tinha selecionado um local deslumbrante que complementava na perfeição a luz, a arquitetura e a atmosfera da cidade.\n\nO que verdadeiramente a destaca é a sua capacidade de trabalhar com crianças. O nosso filho de 6 anos normalmente não gosta de posar e tende a resistir a qualquer foto, mas a Kate conseguiu envolvê-lo quase imediatamente. Transformou a sessão em algo natural e divertido, captando sorrisos genuínos e momentos que para nós teriam sido impossíveis de obter por nós mesmos.\n\nO resultado fala por si — as fotos são luminosas, elegantes e parecem completamente espontâneas, refletindo claramente um forte sentido de composição e um olhar profissional.\n\nA Kate combina fiabilidade, visão artística e uma capacidade excecional de criar uma atmosfera relaxada. Recomendamos vivamente a quem procurar uma fotógrafa de topo em Lisboa.",
      de: "Wir hatten eine herausragende Erfahrung mit der Fotografin Kate Belova in Lissabon.\n\nVon Anfang an wurde alles makellos geplant und durchgeführt. Kate war pünktlich und hatte einen atemberaubenden Ort ausgewählt, der das Licht, die Architektur und die Atmosphäre der Stadt perfekt ergänzte.\n\nWas sie wirklich auszeichnet, ist ihre Fähigkeit, mit Kindern zu arbeiten. Unser 6-jähriger Sohn lässt sich normalerweise ungern fotografieren und sträubt sich gegen jede Aufnahme, aber Kate hat es geschafft, ihn fast sofort zu begeistern. Sie hat das Shooting in etwas Natürliches und Unterhaltsames verwandelt und ehrliche Lächeln und Momente eingefangen, die wir allein nie hätten festhalten können.\n\nDas Ergebnis spricht für sich — die Fotos sind hell, elegant und wirken völlig mühelos, zeigen aber gleichzeitig ein starkes Gespür für Komposition und einen professionellen Blick.\n\nKate vereint Verlässlichkeit, künstlerische Vision und die außergewöhnliche Fähigkeit, eine entspannte Atmosphäre zu schaffen. Wir empfehlen sie wärmstens jedem, der eine erstklassige Fotografin in Lissabon sucht.",
      es: "Tuvimos una experiencia excepcional con la fotógrafa Kate Belova en Lisboa.\n\nDesde el principio, todo se llevó a cabo a la perfección. Kate llegó puntual y había seleccionado un lugar impresionante que complementaba a la perfección la luz, la arquitectura y la atmósfera de la ciudad.\n\nLo que realmente la diferencia es su capacidad para trabajar con niños. Nuestro hijo de 6 años normalmente no le gusta posar y tiende a resistirse a cualquier foto, pero Kate consiguió implicarle casi al instante. Convirtió la sesión en algo natural y divertido, captando sonrisas genuinas y momentos que para nosotros habría sido imposible conseguir solos.\n\nEl resultado habla por sí solo — las fotos son luminosas, elegantes y parecen completamente espontáneas, pero claramente reflejan un gran sentido de la composición y una mirada profesional.\n\nKate combina fiabilidad, visión artística y una capacidad excepcional para crear un ambiente relajado. La recomendamos muchísimo a cualquiera que busque una fotógrafa de primer nivel en Lisboa.",
      fr: "Nous avons vécu une expérience exceptionnelle avec la photographe Kate Belova à Lisbonne.\n\nDès le début, tout a été géré de façon impeccable. Kate est arrivée à l'heure et avait sélectionné un lieu magnifique qui complétait parfaitement la lumière, l'architecture et l'atmosphère de la ville.\n\nCe qui la distingue vraiment, c'est sa capacité à travailler avec les enfants. Notre fils de 6 ans n'aime habituellement pas poser et a tendance à refuser toute photo, mais Kate a réussi à l'impliquer presque instantanément. Elle a transformé la séance en quelque chose de naturel et amusant, capturant des sourires authentiques et des moments qu'il aurait été impossible pour nous d'obtenir seuls.\n\nLe résultat parle de lui-même — les photos sont lumineuses, élégantes et paraissent totalement naturelles, tout en révélant clairement un fort sens de la composition et un œil professionnel.\n\nKate combine fiabilité, vision artistique et une capacité exceptionnelle à créer une atmosphère détendue. Nous la recommandons vivement à toute personne cherchant une photographe de premier plan à Lisbonne.",
    },
  },
  {
    id: "307607b7-7df7-4a53-b08d-5a624b7cf92f",
    title: {
      pt: "Experiência incrível!!",
      de: "Unglaubliche Erfahrung!!",
      es: "¡¡Experiencia increíble!!",
      fr: "Expérience incroyable !!",
    },
    text: {
      pt: "Kate! Finalmente saímos daqueles dias super atarefados, e posso finalmente relaxar e escrever-te um enorme obrigado pelo teu trabalho! Pelo profissionalismo e por tornares tudo tão fácil e agradável!\nDivertimo-nos imenso contigo — foi mesmo agradável e divertido!\nDa próxima vez que estivermos em Lisboa, voltaremos a ver-te de certeza 😅\nMuito obrigada!!\nDesejo-te tudo de bom e muito sucesso! ❤️❤️❤️",
      de: "Kate! Wir sind endlich aus diesen super stressigen Tagen heraus, und ich kann mich endlich entspannen und dir ein riesiges Dankeschön für deine Arbeit schreiben! Für deine Professionalität und dafür, dass du alles so leicht und angenehm gemacht hast!\nWir hatten so viel Spaß mit dir — es war wirklich angenehm und lustig!\nDas nächste Mal, wenn wir in Lissabon sind, kommen wir ganz sicher wieder zu dir 😅\nVielen, vielen Dank!!\nIch wünsche dir alles Gute und viel Erfolg! ❤️❤️❤️",
      es: "¡Kate! Por fin salimos de esos días super liados y por fin puedo relajarme y escribirte un enorme gracias por tu trabajo. Por tu profesionalidad y por hacer que todo fuera tan fácil y agradable.\n¡Lo pasamos genial contigo — fue muy ameno y divertido!\nLa próxima vez que estemos en Lisboa, sin duda volveremos a verte 😅\n¡Muchísimas gracias!\n¡Te deseo lo mejor y mucho éxito! ❤️❤️❤️",
      fr: "Kate ! Nous venons enfin de sortir de ces jours super chargés, et je peux enfin me détendre et t'écrire un immense merci pour ton travail ! Pour ton professionnalisme et pour avoir rendu tout cela si facile et agréable !\nNous nous sommes tellement amusés avec toi — c'était vraiment agréable et amusant !\nLa prochaine fois que nous serons à Lisbonne, nous reviendrons certainement te voir 😅\nMerci beaucoup !!\nJe te souhaite tout le meilleur et beaucoup de succès ! ❤️❤️❤️",
    },
  },
  {
    id: "76b27fa1-4f04-4d05-97ed-36c64840e392",
    title: {
      pt: "Fotos absolutamente deslumbrantes, superaram todas as minhas expectativas!",
      de: "Absolut atemberaubende Fotos, sie haben all meine Erwartungen übertroffen!",
      es: "¡Fotos absolutamente impresionantes, superaron todas mis expectativas!",
      fr: "Des photos absolument magnifiques, qui ont dépassé toutes mes attentes !",
    },
    text: {
      pt: "Aaaah, estas fotos estão incríveis!!! Tão fixes! Ficaram tão bonitas e há tantos planos deslumbrantes!\nMuito, muito obrigada!!!\nAdoro-as completamente!\nEstão ainda melhores do que eu poderia imaginar! ❤️",
      de: "Aaaah, diese Fotos sind unglaublich!!! So cool! Sie sind so wunderschön geworden, und es gibt so viele atemberaubende Aufnahmen!\nVielen, vielen Dank!!!\nIch liebe sie absolut!\nSie sind sogar noch besser, als ich es mir vorstellen konnte! ❤️",
      es: "¡Aaaah, estas fotos son increíbles!!! ¡Súper geniales! Quedaron preciosas, ¡y hay un montón de tomas impresionantes!\n¡Muchísimas, muchísimas gracias!!!\n¡Las adoro!\n¡Están incluso mejor de lo que podía imaginar! ❤️",
      fr: "Aaaah, ces photos sont incroyables !!! Tellement cool ! Elles sont magnifiques et il y a tant de clichés saisissants !\nMerci, merci beaucoup !!!\nJe les adore !\nElles sont même encore mieux que ce que j'aurais pu imaginer ! ❤️",
    },
  },
  {
    id: "c598b873-020b-4a29-b158-7911b6baa599",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Kristina, muito obrigada! Estão lindíssimas! É exatamente o que esperávamos da nossa viagem e capta tantos momentos e memórias. Adoro especialmente como captaste os nossos meninos a brincar — exatamente como estiveram durante toda a viagem. Mal posso esperar para partilhá-las com o resto da família.",
      de: "Kristina, vielen Dank! Sie sehen großartig aus! Es ist genau das, was wir uns von unserer Reise erhofft hatten, und es fängt so viele Momente und Erinnerungen ein. Ich liebe es besonders, wie du unsere Jungs in ihrer Verspieltheit eingefangen hast — genau so, wie sie während der ganzen Reise waren. Ich kann es kaum erwarten, sie mit dem Rest der Familie zu teilen.",
      es: "Kristina, ¡muchas gracias! ¡Quedaron preciosas! Es exactamente lo que esperábamos de nuestro viaje y capta muchísimos momentos y recuerdos. Me encanta especialmente cómo captaste a nuestros niños jugando — justo como estuvieron durante todo el viaje. No puedo esperar a compartirlas con el resto de la familia.",
      fr: "Kristina, merci beaucoup ! Elles sont magnifiques ! C'est exactement ce que nous espérions de notre voyage et elles capturent tant de moments et de souvenirs. J'adore particulièrement la façon dont tu as capturé nos garçons dans leur énergie joueuse — exactement comme ils ont été tout au long du voyage. J'ai hâte de les partager avec le reste de la famille.",
    },
  },
];

const client = new Client({
  user: "photoportugal",
  password: "PhotoPortugal2026Secure",
  host: "localhost",
  database: "photoportugal",
  port: 5432,
});

await client.connect();

for (const r of REV) {
  const cols = [];
  const params = [];
  for (const loc of ["pt", "de", "es", "fr"]) {
    if (r.title?.[loc] !== undefined) {
      cols.push(`title_${loc} = $${params.length + 1}`);
      params.push(r.title[loc] || null);
    }
    if (r.text?.[loc] !== undefined) {
      cols.push(`text_${loc} = $${params.length + 1}`);
      params.push(r.text[loc] || null);
    }
  }
  cols.push(`translations_dirty = FALSE`);
  params.push(r.id);
  await client.query(
    `UPDATE reviews SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params
  );
  console.log(`✓ ${r.id.slice(0, 8)}`);
}

await client.end();
console.log(`\nBatch rev-6 done — ${REV.length} reviews translated. Total: 347/347 reviews complete.`);

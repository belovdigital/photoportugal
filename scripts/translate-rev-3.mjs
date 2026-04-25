// Reviews batch 3 — next 60 reviews → PT/DE/ES/FR
import pg from "pg";
const { Client } = pg;

const REV = [
  {
    id: "c0dd89bc-7f9d-4b54-b288-eddb245496a6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A sensibilidade e o talento da Sophie transformam imagens, do detalhe à arte. As fotografias que cria têm alma e deixam-nos seguros e livres para mostrar o nosso lado mais artístico e bonito.\nSem dúvida uma das melhores fotógrafas que conheço.",
      de: "Sophies Feingefühl und Talent verwandeln Bilder vom kleinsten Detail in Kunst. Die Fotos, die sie macht, haben Seele und lassen uns sicher und frei genug, unsere künstlerischste und schönste Seite zu zeigen.\nDefinitiv eine der besten Fotografinnen, die ich kenne.",
      es: "La sensibilidad y el talento de Sophie transforman las imágenes, del detalle al arte. Las fotografías que hace tienen alma y nos hacen sentir seguras y libres para mostrar nuestro lado más artístico y bonito.\nSin duda, una de las mejores fotógrafas que conozco.",
      fr: "La sensibilité et le talent de Sophie transforment les images, du détail à l'art. Les photographies qu'elle crée ont une âme et nous laissent en confiance, libres de montrer notre côté le plus artistique et le plus beau.\nSans aucun doute l'une des meilleures photographes que je connaisse.",
    },
  },
  {
    id: "9efb9dde-efc1-4592-8888-70ad02665e00",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie é uma pessoa maravilhosa para trabalhar! É tão fácil estar com ela. Garante sempre que toda a gente se sinta bem e que o ambiente se adapte às necessidades de todos. E tudo é feito com imensa diversão!💗",
      de: "Mit Sophie zu arbeiten, ist einfach wunderbar! Es ist so leicht, in ihrer Nähe zu sein. Sie sorgt immer dafür, dass sich alle wohlfühlen und dass die Atmosphäre für jeden passt. Und das alles bei jeder Menge Spaß!💗",
      es: "¡Sophie es una persona maravillosa para trabajar! Es facilísimo estar con ella. Siempre se asegura de que todo el mundo se sienta bien y de que el ambiente encaje con las necesidades de cada uno. ¡Y todo se hace pasándolo genial!💗",
      fr: "Travailler avec Sophie est tout simplement merveilleux ! C'est tellement facile d'être à ses côtés. Elle s'assure toujours que tout le monde se sente bien et que l'ambiance corresponde aux besoins de chacun. Et tout cela en s'amusant énormément !💗",
    },
  },
  {
    id: "5e75c22a-c523-4f80-8bd2-313b2d7cc26b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não é só uma fotógrafa incrível, é também um ser humano realmente gentil e doce! Adorei cada parte das nossas sessões criativas! Obrigada Sophie 🥰🙏🏻\n❤️1\nSophie Bellmann — Fotógrafa em Lisboa e Costa da Caparica",
      de: "Sie ist nicht nur eine fantastische Fotografin, sondern auch ein wirklich liebenswerter, sanfter Mensch! Ich habe jeden Moment unserer kreativen Sessions geliebt! Danke, Sophie 🥰🙏🏻\n❤️1\nSophie Bellmann — Fotografin in Lissabon & Costa da Caparica",
      es: "¡No solo es una fotógrafa increíble, sino también un ser humano realmente amable y dulce! ¡Adoré cada momento de nuestras sesiones creativas! Gracias, Sophie 🥰🙏🏻\n❤️1\nSophie Bellmann — Fotógrafa en Lisboa y Costa da Caparica",
      fr: "Ce n'est pas seulement une photographe incroyable, c'est aussi une personne vraiment gentille et douce ! J'ai adoré chaque instant de nos séances créatives ! Merci, Sophie 🥰🙏🏻\n❤️1\nSophie Bellmann — Photographe à Lisbonne et Costa da Caparica",
    },
  },
  {
    id: "48104d3c-1977-4b80-9aed-d4a36e1261ce",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fotógrafa maravilhosa!\nFizemos uma sessão fotográfica em grupo grande e os resultados foram incríveis!",
      de: "Wunderbare Fotografin!\nWir hatten ein Shooting mit einer großen Gruppe und die Ergebnisse waren fantastisch!",
      es: "¡Maravillosa fotógrafa!\nHicimos una sesión fotográfica con un grupo grande y los resultados fueron increíbles.",
      fr: "Une photographe formidable !\nNous avons fait une séance photo avec un grand groupe, et les résultats sont incroyables !",
    },
  },
  {
    id: "2980b1a5-65ca-4068-ab28-b8c964945e2d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie é uma excelente profissional. Ouve com atenção e coloca a sua criatividade ao serviço do projeto pedido. Ser fotografada por ela foi um momento muito especial. Para além disso, o resultado das fotos foi incrível. Conseguimos captar exatamente aquilo que eu queria que estas fotos transmitissem. Obrigada, Sophie ♥️",
      de: "Sophie ist eine hervorragende Profi. Sie hört aufmerksam zu und stellt ihre Kreativität in den Dienst des angefragten Projekts. Von ihr fotografiert zu werden, war ein ganz besonderer Moment. Außerdem war das Ergebnis der Fotos unglaublich. Wir haben genau das eingefangen, was ich mit diesen Bildern vermitteln wollte. Danke, Sophie ♥️",
      es: "Sophie es una excelente profesional. Escucha con atención y pone su creatividad al servicio del proyecto. Que ella me fotografiara fue un momento muy especial. Además, el resultado de las fotos fue increíble. Conseguimos captar exactamente lo que yo quería que estas fotos transmitieran. Gracias, Sophie ♥️",
      fr: "Sophie est une excellente professionnelle. Elle écoute attentivement et met sa créativité au service du projet demandé. Être photographiée par elle a été un moment très spécial. Et en plus, le résultat des photos est incroyable. Nous avons réussi à capturer exactement ce que je voulais transmettre avec ces images. Merci, Sophie ♥️",
    },
  },
  {
    id: "5615cdb8-a421-439c-a525-d00cdfce3137",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalhar com a Sophie é, acima de tudo, simples e profissional. Cria um ambiente em que nos sentimos confortáveis e podemos largar-nos, e isso reflete-se nos belos resultados.",
      de: "Mit Sophie zu arbeiten, ist vor allem unkompliziert und professionell. Sie schafft eine Atmosphäre, in der man sich wohlfühlt und sich gehen lassen kann, und das spiegelt sich in den wunderschönen Ergebnissen wider.",
      es: "Trabajar con Sophie es, sobre todo, fácil y profesional. Crea un ambiente en el que te sientes cómodo y puedes dejarte ir, y eso se refleja en los preciosos resultados.",
      fr: "Travailler avec Sophie est avant tout simple et professionnel. Elle crée une ambiance dans laquelle on se sent à l'aise et où l'on peut se lâcher, et cela se reflète dans les magnifiques résultats.",
    },
  },
  {
    id: "bdaf0cc9-52fe-441c-98f4-027c62f705b3",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Sophie Bellmann — Fotógrafa em Lisboa e Costa da Caparica",
      de: "Sophie Bellmann — Fotografin in Lissabon & Costa da Caparica",
      es: "Sophie Bellmann — Fotógrafa en Lisboa y Costa da Caparica",
      fr: "Sophie Bellmann — Photographe à Lisbonne et Costa da Caparica",
    },
  },
  {
    id: "1e28208b-737f-4750-b6ff-0e5bda895b4a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana adaptou a sessão fotográfica aos meus desejos e captou mesmo todos os sentimentos. Senti-me muito relaxada e ela orientou-me bem durante a sessão. Recebi fotos espetaculares e foram-me entregues no dia seguinte! Recomendo totalmente a quem queira fotos profissionais da viagem.",
      de: "Tatiana hat das Shooting genau auf meine Wünsche zugeschnitten und wirklich alle Gefühle eingefangen. Ich habe mich sehr entspannt gefühlt und sie hat mich super durch das Shooting geführt. Die Fotos sind großartig geworden — und ich habe sie schon am nächsten Tag bekommen! Ich kann es jedem empfehlen, der professionelle Fotos von seiner Reise haben möchte.",
      es: "Tatiana adaptó la sesión a mis deseos y captó todas las sensaciones. Me sentí muy relajada y me guio muy bien durante la sesión. Las fotos son espectaculares ¡y me las entregaron al día siguiente! Lo recomiendo totalmente a cualquiera que quiera fotos profesionales de su viaje.",
      fr: "Tatiana a adapté la séance à mes envies et a vraiment capturé toutes les émotions. Je me suis sentie très détendue et elle m'a très bien guidée pendant la séance. Les photos sont magnifiques et m'ont été livrées dès le lendemain ! Je recommande totalement à tous ceux qui veulent des photos professionnelles de leur voyage.",
    },
  },
  {
    id: "71c0288b-0572-4133-9211-6d43e8b8838c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana foi excelente! Levou-nos a bairros que ainda não tínhamos visitado e tirou fotos lindas que nós próprios não conseguiríamos captar. Foi também super simpática e flexível durante toda a experiência. Recomendo vivamente esta sessão fotográfica a toda a gente!",
      de: "Tatiana war fantastisch! Sie hat uns in Viertel mitgenommen, die wir noch nicht besucht hatten, und wunderschöne Fotos gemacht, die wir selbst nie hinbekommen hätten. Außerdem war sie während der gesamten Zeit super freundlich und flexibel. Ich kann dieses Foto-Shooting wirklich jedem empfehlen!",
      es: "¡Tatiana fue genial! Nos llevó a barrios que todavía no habíamos visitado e hizo fotos preciosas que nosotros mismos no habríamos podido lograr. Además fue súper simpática y flexible durante toda la experiencia. ¡Recomiendo muchísimo esta experiencia fotográfica a todo el mundo!",
      fr: "Tatiana a été superbe ! Elle nous a emmenés dans des quartiers que nous n'avions pas encore visités et a pris de magnifiques photos que nous n'aurions jamais pu faire nous-mêmes. Elle a aussi été super sympa et flexible tout au long de l'expérience. Je recommande vivement cette séance photo à tout le monde !",
    },
  },
  {
    id: "9ee9c058-b2a7-45ad-a532-3fdf1d495f1c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Ricardo captou o nosso casamento de forma maravilhosa! Fez-nos sentir descontraídos e foi muito atencioso e profissional. Recomendo vivamente! ❤️2",
      de: "Ricardo hat unsere Hochzeit wunderschön festgehalten! Er hat dafür gesorgt, dass wir entspannt waren, und war sehr aufmerksam und professionell. Sehr zu empfehlen! ❤️2",
      es: "¡Ricardo captó nuestra boda de forma maravillosa! Nos hizo sentir relajados y fue muy atento y profesional. ¡Muy recomendable! ❤️2",
      fr: "Ricardo a magnifiquement immortalisé notre mariage ! Il nous a mis à l'aise et a été très attentif et professionnel. Vivement recommandé ! ❤️2",
    },
  },
  {
    id: "d170a246-db1a-45d8-b0c6-24a6ef68106d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Ricardo e a sua equipa fizeram um trabalho notável e estamos muito felizes com o resultado. São todos adoráveis e muito profissionais — dedicam tempo aos clientes para perceberem realmente o que queremos. Para nós, que vivemos em França, mostrou disponibilidade para se adaptar às nossas marcações e também muita paciência para perceber bem as nossas expectativas. Recomendamos também o trabalho do livro, das fotografias impressas e dos filmes do dia do casamento — tanto o filme curto como o filme completo, um trabalho extraordinário e sem falhas. Voltaremos a trabalhar com eles se a oportunidade surgir.",
      de: "Ricardo und sein Team haben großartige Arbeit geleistet, und wir sind sehr zufrieden mit dem Ergebnis. Sie sind alle reizend und sehr professionell — sie nehmen sich die Zeit, um wirklich zu verstehen, was die Kunden wollen. Für uns, die in Frankreich leben, hat er sich bei den Terminen sehr flexibel gezeigt und viel Geduld bewiesen, um unsere Erwartungen genau zu verstehen. Wir empfehlen auch das Hochzeitsalbum, die gedruckten Fotos und die Filme des Hochzeitstages — sowohl den kurzen als auch den langen Film — eine außergewöhnliche, makellose Arbeit. Wenn sich die Gelegenheit ergibt, arbeiten wir gerne wieder mit ihnen zusammen.",
      es: "Ricardo y su equipo hicieron un trabajo extraordinario y estamos muy contentos con el resultado. Son todos encantadores y muy profesionales: dedican tiempo a los clientes para entender bien lo que quieren. Para nosotros, que vivimos en Francia, mostró flexibilidad con las citas y también mucha paciencia para entender bien nuestras expectativas. Recomendamos también el trabajo del álbum, las fotos impresas y los vídeos del día de la boda, tanto el vídeo corto como el vídeo completo: un trabajo extraordinario y sin fallos. Volveremos a trabajar con ellos si surge la oportunidad.",
      fr: "Ricardo et son équipe ont réalisé un travail remarquable, nous sommes très satisfaits du résultat. Ils sont tous adorables et très professionnels — ils prennent le temps avec leurs clients pour bien comprendre ce que l'on veut. Pour nous, qui vivons en France, il a su s'adapter pour nos rendez-vous et a aussi fait preuve de beaucoup de patience afin de bien comprendre nos attentes. Nous recommandons également le travail du livre, les photos imprimées ainsi que le film du jour du mariage et le film complet — un travail extraordinaire et sans faute. Nous referons appel à eux si l'occasion se présente.",
    },
  },
  {
    id: "c30b5d16-68c4-4362-b071-b2c2be1c5f33",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratámos o Ricardo para o batizado da nossa filha Chiara e ficámos muito satisfeitos com o resultado, tanto das fotos como do vídeo, e o álbum ficou lindíssimo! No dia do batizado, o Ricardo e o seu colega fizeram-nos sentir confortáveis e foram super flexíveis com os nossos pedidos. A entrega foi feita num prazo razoável. Foi sempre fácil comunicar com o Ricardo para qualquer dúvida.",
      de: "Wir haben Ricardo für die Taufe unserer Tochter Chiara engagiert und waren sehr zufrieden mit dem Ergebnis, sowohl bei den Fotos als auch beim Video — und das Album ist wunderschön geworden! Am Tag der Taufe haben Ricardo und sein Kollege dafür gesorgt, dass wir uns wohlfühlen, und waren super flexibel bei unseren Wünschen. Die Lieferung erfolgte in einem angemessenen Zeitraum. Mit Ricardo zu kommunizieren, war bei allen Fragen jederzeit einfach.",
      es: "Contratamos a Ricardo para el bautizo de nuestra hija Chiara y quedamos muy contentos con el resultado, tanto de las fotos como del vídeo, ¡y el álbum quedó precioso! El día del bautizo, Ricardo y su compañero nos hicieron sentir cómodos y fueron súper flexibles con nuestras peticiones. La entrega se hizo en un plazo razonable. Siempre fue fácil comunicarnos con Ricardo ante cualquier duda.",
      fr: "Nous avons fait appel à Ricardo pour le baptême de notre fille Chiara et nous avons été très satisfaits du résultat, tant pour les photos que pour la vidéo — et l'album est magnifique ! Le jour du baptême, Ricardo et son collègue nous ont mis à l'aise et ont été super flexibles avec nos demandes. La livraison s'est faite dans des délais raisonnables. Il a toujours été facile de communiquer avec Ricardo pour la moindre question.",
    },
  },
  {
    id: "32dc51ea-6d83-4e9c-8f38-02dab33931f2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Escolhi o Ricardo para o batizado do meu filho. Não podia ter feito melhor escolha; a comunicação e a organização, do início à entrega do álbum, foram 5*. Destaca-se pela qualidade — sem dúvida uma experiência que vou repetir no futuro.",
      de: "Ich habe Ricardo für die Taufe meines Sohnes ausgewählt. Eine bessere Wahl hätte ich nicht treffen können — die Kommunikation und Organisation vom Anfang bis zur Übergabe des Albums waren 5*. Besonders überzeugt hat die Qualität — eine Erfahrung, die ich in Zukunft sicher wiederholen werde.",
      es: "Elegí a Ricardo para el bautizo de mi hijo. No podría haber hecho mejor elección; la comunicación y la organización, desde el principio hasta la entrega del álbum, fueron de 5*. Destaca por la calidad: sin duda una experiencia que voy a repetir en el futuro.",
      fr: "J'ai choisi Ricardo pour le baptême de mon fils. Je n'aurais pas pu mieux choisir ; la communication et l'organisation, du début à la livraison de l'album, ont été 5*. Il se distingue par la qualité — une expérience que je referai sans aucun doute à l'avenir.",
    },
  },
  {
    id: "7b11416f-70c1-4c56-b0b9-9a8fbbff6dcb",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Escolhemos o Ricardo para o batizado do nosso filho e o serviço prestado foi excelente. A comunicação foi muito boa, com o Ricardo sempre a fornecer toda a informação de forma clara e o mais rápido possível. A organização do evento e o trabalho do Ricardo foram muito simples, acolhendo todos os nossos pedidos. A entrega foi rápida, dentro do possível, e não houve problemas com o pedido. Tudo foi entregue tal como combinado. No geral, o trabalho do Ricardo e da sua equipa foi excelente, correspondendo às nossas expectativas. Tanto as fotos como o vídeo são uma excelente recordação de um dia especial para nós. Recomendamos o Ricardo e a sua equipa, sem qualquer dúvida, para este tipo de trabalho.",
      de: "Wir haben Ricardo für die Taufe unseres Sohnes ausgewählt, und der Service war hervorragend. Die Kommunikation war sehr gut, Ricardo hat alle Informationen stets klar und so schnell wie möglich bereitgestellt. Die Organisation des Events und Ricardos Arbeit waren sehr unkompliziert — alle unsere Wünsche wurden berücksichtigt. Die Lieferung war so schnell wie möglich, und es gab keinerlei Probleme mit der Bestellung. Alles wurde wie vereinbart geliefert. Insgesamt war die Arbeit von Ricardo und seinem Team ausgezeichnet und entsprach voll unseren Erwartungen. Sowohl die Fotos als auch das Video sind eine wunderbare Erinnerung an einen besonderen Tag. Wir empfehlen Ricardo und sein Team ohne Vorbehalt für diese Art von Auftrag.",
      es: "Elegimos a Ricardo para el bautizo de nuestro hijo y el servicio prestado fue excelente. La comunicación fue muy buena, Ricardo siempre nos daba toda la información con claridad y lo más rápido posible. La organización del evento y el trabajo de Ricardo fueron muy sencillos, atendiendo todas nuestras peticiones. La entrega fue rápida, dentro de lo posible, y no hubo ningún problema con el pedido. Todo se entregó tal y como acordamos. En general, el trabajo de Ricardo y su equipo fue excelente, cumplió con nuestras expectativas. Tanto las fotos como el vídeo son un recuerdo magnífico de un día muy especial. Recomendamos a Ricardo y a su equipo sin ninguna duda para este tipo de trabajo.",
      fr: "Nous avons choisi Ricardo pour le baptême de notre fils et le service fourni a été excellent. La communication a été très bonne, Ricardo nous a toujours fourni toutes les informations clairement et le plus rapidement possible. L'organisation de l'événement et le travail de Ricardo ont été très simples, toutes nos demandes ont été prises en compte. La livraison a été rapide, dans la mesure du possible, et il n'y a eu aucun problème avec la commande. Tout a été livré comme convenu. Dans l'ensemble, le travail de Ricardo et de son équipe a été excellent, à la hauteur de nos attentes. Tant les photos que la vidéo sont d'excellents souvenirs d'une journée très spéciale pour nous. Nous recommandons Ricardo et son équipe sans aucune hésitation pour ce type de travail.",
    },
  },
  {
    id: "0f366406-64e7-411c-a769-a838f5c40860",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Encontrei o estúdio do Ricardo Moura online quando procurava um fotógrafo para o batizado do meu filho. Não podia estar mais feliz; o trabalho do fotógrafo Paulo foi extraordinário. Sentimo-nos imediatamente super à vontade e ele captou momentos incríveis que vão durar para sempre. Muito obrigada!",
      de: "Ich bin online auf Ricardo Mouras Studio gestoßen, als ich einen Fotografen für die Taufe meines Sohnes suchte. Ich könnte nicht glücklicher sein; die Arbeit des Fotografen Paulo war außergewöhnlich. Wir haben uns sofort unglaublich wohlgefühlt, und er hat fantastische Momente eingefangen, die jetzt für immer bleiben. Vielen Dank!",
      es: "Encontré el estudio de Ricardo Moura por internet cuando buscaba fotógrafo para el bautizo de mi hijo. No podría estar más contenta; el trabajo del fotógrafo Paulo fue extraordinario. Nos sentimos súper cómodos enseguida y captó momentos increíbles que ahora durarán para siempre. ¡Muchísimas gracias!",
      fr: "Je suis tombée sur le studio de Ricardo Moura en ligne en cherchant un photographe pour le baptême de mon fils. Je ne pourrais pas être plus heureuse ; le travail du photographe Paulo a été extraordinaire. Nous nous sommes sentis tout de suite très à l'aise, et il a capté des moments incroyables qui resteront à jamais. Merci beaucoup !",
    },
  },
  {
    id: "4133e243-e0f4-4c62-b6ab-2e31a404afe5",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "As fotos do meu filho foram entregues e a fotógrafa foi excelente, sensível e dedicada com ele, sempre disposta a ajustar coisas que já tinham sido planeadas. Só posso agradecer pelo excelente trabalho. Recomendo.",
      de: "Die Fotos meines Sohnes wurden geliefert, und die Fotografin war hervorragend — einfühlsam, mit viel Hingabe und immer bereit, bereits geplante Dinge anzupassen. Ich kann mich nur für die ausgezeichnete Arbeit bedanken. Sehr zu empfehlen.",
      es: "La foto de mi hijo fue entregada, y la fotógrafa fue excelente, sensible y dedicada con él, siempre dispuesta a ajustar cosas que ya estaban planeadas. Solo puedo darle las gracias por el excelente trabajo. La recomiendo.",
      fr: "Les photos de mon fils ont été livrées, et la photographe a été excellente, sensible et dévouée avec lui, toujours prête à ajuster des choses déjà prévues. Je ne peux que la remercier pour l'excellent travail. Je la recommande.",
    },
  },
  {
    id: "8e09467f-f632-4c39-9022-6b5df8e6ad09",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Primeira Comunhão. A conversa inicial para ajustar o serviço foi clara, e o plano combinado foi cumprido na totalidade. Organização geral muito boa, e a entrega foi rápida e de elevada qualidade.",
      de: "Erstkommunion. Das erste Gespräch zur Abstimmung der Leistung war klar, und der vereinbarte Plan wurde vollständig umgesetzt. Sehr gute Gesamtorganisation, und die Lieferung war schnell und qualitativ hochwertig.",
      es: "Primera Comunión. La conversación inicial para ajustar el servicio fue clara, y el plan acordado se cumplió en su totalidad. Muy buena organización general, y la entrega fue rápida y de gran calidad.",
      fr: "Première communion. L'entretien initial pour ajuster la prestation a été clair, et le plan convenu a été pleinement respecté. Très bonne organisation générale, et la livraison a été rapide et de grande qualité.",
    },
  },
  {
    id: "69ca0e1e-7367-42b5-ba3f-3d625d75ce32",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei a sessão fotográfica, ótimas pessoas, super simpáticas, cenário impecável, absolutamente perfeito! Adorei mesmo, vou voltar a fazê-lo de certeza.",
      de: "Ich habe das Shooting geliebt — tolle Leute, super freundlich, makelloses Setting, einfach perfekt! Ich habe es wirklich genossen und werde es ganz sicher wiederholen.",
      es: "¡Me encantó la sesión, gente maravillosa, súper simpáticos, escenario impecable, absolutamente perfecto! Disfruté muchísimo y, sin duda, lo volveré a hacer.",
      fr: "J'ai adoré la séance, des gens formidables, super sympas, un décor impeccable, absolument parfait ! J'ai vraiment adoré, je referai sans aucun doute.",
    },
  },
  {
    id: "0fb010ab-dc92-497c-a0b9-1fae14f7d692",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Vocês são mais do que fotógrafos, são família!\nObrigada pelo excelente trabalho que têm feito e continuam a fazer com todas as famílias. ❤",
      de: "Ihr seid mehr als Fotografen, ihr seid Familie!\nVielen Dank für die großartige Arbeit, die ihr geleistet habt und weiterhin für all eure Familien leistet. ❤",
      es: "¡Sois más que fotógrafos, sois familia!\nGracias por el excelente trabajo que habéis hecho y seguís haciendo con todas las familias. ❤",
      fr: "Vous êtes bien plus que des photographes, vous êtes une famille !\nMerci pour l'excellent travail que vous avez fait et continuez de faire avec toutes les familles. ❤",
    },
  },
  {
    id: "0b44568a-d09c-490c-b03c-a7f85676cc94",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Experiência espetacular.\nFoi a nossa primeira sessão fotográfica em família e é algo que nunca vamos esquecer.\nMuito obrigada 😊",
      de: "Ein spektakuläres Erlebnis.\nEs war unser erstes Familien-Shooting und etwas, das wir nie vergessen werden.\nVielen Dank 😊",
      es: "Experiencia espectacular.\nFue nuestra primera sesión de fotos en familia y es algo que nunca olvidaremos.\nMuchísimas gracias 😊",
      fr: "Une expérience spectaculaire.\nC'était notre première séance photo en famille, et c'est quelque chose que nous n'oublierons jamais.\nMerci beaucoup 😊",
    },
  },
  {
    id: "cc87d261-9c14-43dd-a642-04060bec9f8f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Depois de várias tentativas frustradas, encontrei a Chris, que me deu tantas fotos maravilhosas que não sabia qual escolher. A experiência foi fantástica, vou repetir de certeza e recomendo vivamente. A Chris é uma pessoa autêntica e interessante, com um sentido de humor agradável. Não foi só uma tarde bem passada — o resultado foi excecional.",
      de: "Nach mehreren gescheiterten Versuchen habe ich Chris gefunden, die mir so viele wunderschöne Fotos geschenkt hat, dass ich gar nicht wusste, welches ich auswählen soll. Die Erfahrung war fantastisch, ich werde sie ganz sicher wiederholen und empfehle sie wärmstens. Chris ist eine authentische und interessante Person mit einem angenehmen Humor. Es war nicht nur ein schön verbrachter Nachmittag — das Ergebnis war außergewöhnlich.",
      es: "Después de varios intentos fallidos, encontré a Chris, que me dio tantas fotos maravillosas que no sabía con cuál quedarme. La experiencia fue fantástica, la voy a repetir seguro y la recomiendo muchísimo. Chris es una persona auténtica e interesante, con un sentido del humor muy agradable. No fue solo una tarde bien pasada: el resultado fue excepcional.",
      fr: "Après plusieurs tentatives infructueuses, j'ai trouvé Chris, qui m'a donné tant de magnifiques photos que je ne savais pas laquelle choisir. L'expérience a été fantastique, je vais sans aucun doute la refaire et je la recommande vivement. Chris est une personne authentique et intéressante, avec un humour très agréable. Ce n'était pas seulement un après-midi bien passé — le résultat a été exceptionnel.",
    },
  },
  {
    id: "f05fd3c6-089d-4b79-9cca-ad98747461a2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Espetacular ❤️",
      de: "Spektakulär ❤️",
      es: "Espectacular ❤️",
      fr: "Spectaculaire ❤️",
    },
  },
  {
    id: "2fc19248-5e67-414d-be9b-74bc8eb2784e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Excelente fotógrafa, sessões descontraídas e fotos emocionantes!",
      de: "Ausgezeichnete Fotografin, entspannte Shootings und mitreißende Bilder!",
      es: "¡Excelente fotógrafa, sesiones relajadas y fotos emocionantes!",
      fr: "Excellente photographe, des séances détendues et des photos qui émeuvent !",
    },
  },
  {
    id: "92210e81-237d-4128-a452-7643f6057e66",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uma profissional impecável,\nMuito atenciosa, adorei o trabalho que fez 🥰 …",
      de: "Eine makellose Profi,\nsehr aufmerksam, ich habe ihre Arbeit einfach geliebt 🥰 …",
      es: "Una profesional impecable,\nMuy atenta, me encantó el trabajo que hizo 🥰 …",
      fr: "Une professionnelle impeccable,\nTrès attentionnée, j'ai adoré le travail qu'elle a fait 🥰 …",
    },
  },
  {
    id: "87ddaaf2-f73a-4381-9f10-af04d8824b15",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Espetacular, além de ser super doce e simpática, foi paciente. Correspondeu a todas as nossas ideias e expectativas. Recomendo a 100%.",
      de: "Spektakulär — sie ist nicht nur super lieb und freundlich, sondern auch geduldig. Sie hat all unsere Ideen und Erwartungen erfüllt. Ich kann sie zu 100 % empfehlen.",
      es: "Espectacular, además de ser súper dulce y amable, fue paciente. Cumplió con todas nuestras ideas y expectativas. La recomiendo al 100%.",
      fr: "Spectaculaire — en plus d'être super douce et sympa, elle a été patiente. Elle a répondu à toutes nos idées et attentes. Je la recommande à 100 %.",
    },
  },
  {
    id: "041b594a-20b4-41a5-b003-34ac58ea7bbd",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fantástico, sentimo-nos super à vontade.",
      de: "Fantastisch — wir haben uns total entspannt gefühlt.",
      es: "Fantástico, nos sentimos súper cómodos.",
      fr: "Fantastique, nous nous sommes sentis super à l'aise.",
    },
  },
  {
    id: "999a89d0-db58-4135-a915-61317c346c7d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Um ambiente familiar e uma abordagem altamente profissional. Sentimo-nos extremamente bem-vindos e à vontade. Adorámos o cenário e todo o ambiente envolvente. De certeza que vamos voltar a contar com os seus serviços.",
      de: "Eine familiäre Atmosphäre und ein hochprofessioneller Ansatz. Wir haben uns extrem willkommen und wohl gefühlt. Wir haben das Setting und das gesamte Ambiente geliebt. Wir werden ihre Dienste ganz sicher wieder in Anspruch nehmen.",
      es: "Un ambiente familiar y un enfoque muy profesional. Nos sentimos muy bienvenidos y cómodos. Nos encantó el escenario y todo el entorno. Sin duda volveremos a contar con sus servicios.",
      fr: "Une ambiance familiale et une approche très professionnelle. Nous nous sommes sentis extrêmement bien accueillis et à l'aise. Nous avons adoré le décor et l'ensemble de l'atmosphère. Nous referons sans aucun doute appel à leurs services.",
    },
  },
  {
    id: "cbd42295-500a-45d6-a745-8f0b349c123a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi o segundo ano em que fizemos uma sessão de Natal com o David.\nNo ano passado fizemos uma sessão de interior, num espaço especialmente decorado, com fotos de família ao lado da árvore de Natal (éramos quatro e sentimo-nos completamente livres para nos organizarmos de várias formas).\nEste ano fizemos uma sessão ao ar livre para aproveitar a decoração de Natal da nossa vila (éramos três, mas o foco foi sem dúvida na minha filha de 4 anos).\nAdorámos!\nO David (e a Joana também) fazem-nos sentir confortáveis e fazem um trabalho espetacular a entregar as melhores recordações. Têm uma enorme paciência e disponibilidade para garantir o melhor serviço.\nNão tenho dúvidas de que vou continuar a confiar no trabalho deles e recomendo a toda a gente que viva esta experiência.",
      de: "Es war das zweite Jahr, in dem wir mit David ein Weihnachts-Shooting gemacht haben.\nLetztes Jahr hatten wir ein Indoor-Shooting in einem extra dekorierten Raum, mit Familienfotos neben dem Weihnachtsbaum (wir waren zu viert und konnten uns absolut frei verschieden zusammenstellen).\nDieses Jahr haben wir ein Outdoor-Shooting gemacht, um die Weihnachtsdekoration in unserem Dorf zu nutzen (wir waren zu dritt, aber der Fokus lag eindeutig auf meiner 4-jährigen Tochter).\nWir haben es geliebt!\nDavid (und auch Joana) sorgen dafür, dass man sich wohlfühlt, und liefern auf spektakuläre Weise die schönsten Erinnerungen. Sie haben enorme Geduld und Verfügbarkeit, um den besten Service zu garantieren.\nIch habe keinen Zweifel, dass ich weiterhin auf ihre Arbeit vertrauen werde, und empfehle allen, diese Erfahrung zu machen.",
      es: "Fue el segundo año que hicimos una sesión de Navidad con David.\nEl año pasado hicimos una sesión interior en un espacio especialmente decorado, con fotos de familia junto al árbol de Navidad (éramos cuatro y nos sentimos completamente libres para colocarnos de muchas formas).\nEste año hicimos una sesión al aire libre para aprovechar la decoración navideña de nuestro pueblo (éramos tres, pero sin duda el foco fue mi hija de 4 años).\n¡Nos encantó!\nDavid (y Joana también) te hacen sentir cómodo y hacen un trabajo espectacular entregando los mejores recuerdos. Tienen una enorme paciencia y disponibilidad para garantizar el mejor servicio.\nNo tengo ninguna duda de que voy a seguir confiando en su trabajo y recomiendo a todo el mundo que viva esta experiencia.",
      fr: "C'était la deuxième année que nous faisions une séance de Noël avec David.\nL'année dernière, nous avons fait une séance en intérieur, dans un espace spécialement décoré, avec des photos de famille à côté du sapin de Noël (nous étions quatre et nous nous sommes sentis totalement libres de nous placer de différentes manières).\nCette année, nous avons fait une séance en extérieur pour profiter des décorations de Noël de notre village (nous étions trois, mais le focus était sans aucun doute sur ma fille de 4 ans).\nNous avons adoré !\nDavid (et Joana aussi) vous mettent à l'aise et font un travail spectaculaire pour livrer les plus beaux souvenirs. Ils ont énormément de patience et de disponibilité pour garantir le meilleur service.\nJe n'ai aucun doute que je continuerai à faire confiance à leur travail et je recommande à tout le monde de vivre cette expérience.",
    },
  },
  {
    id: "721320a8-a4cb-4807-a348-6076129dd056",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recomendo vivamente os serviços do Sr. José Santos — para além do seu profissionalismo, a sua simpatia é contagiante. Muito obrigada, Sr. José, adorei o seu serviço no batizado da minha filha Beatriz e provavelmente voltarei a contratá-lo para futuros eventos.",
      de: "Ich empfehle die Dienste von Herrn José Santos wärmstens — neben seiner Professionalität ist seine Freundlichkeit ansteckend. Vielen Dank, Herr José, ich habe Ihren Service bei der Taufe meiner Tochter Beatriz geliebt und werde Sie für zukünftige Anlässe sehr wahrscheinlich wieder buchen.",
      es: "Recomiendo muchísimo los servicios del Sr. José Santos — además de su profesionalidad, su simpatía es contagiosa. Muchísimas gracias, Sr. José, me encantó su servicio en el bautizo de mi hija Beatriz y seguramente volveré a contratarle para futuros eventos.",
      fr: "Je recommande vivement les services de M. José Santos — au-delà de son professionnalisme, sa gentillesse est contagieuse. Merci beaucoup, M. José, j'ai adoré votre service au baptême de ma fille Beatriz et je vous referai très probablement appel pour de futurs événements.",
    },
  },
  {
    id: "d647c65e-d15a-4458-a953-482ae093230a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Desde a primeira mensagem, soube que estava nas melhores mãos com a Patricia. Foi incrivelmente profissional, simpática, atenta e detalhista a ajudar-me a planear o meu pedido de casamento surpresa em Lisboa — ainda antes de a conhecer pessoalmente. Sugeriu locais, explicou tudo com clareza e fez com que nos sentíssemos confiantes e descontraídos a cada passo.\nE depois… chegou o dia, e choveu. Mas a Patricia transformou tudo em magia.\nEla e a sua maravilhosa assistente criaram uma atmosfera calma, acolhedora e linda, em que pudemos simplesmente ser nós próprios — e, de alguma forma, captaram cada detalhe emocional do nosso pedido de casamento com graça, calor humano e imenso talento. As fotos estão deslumbrantes. Românticas, humanas, vívidas, íntimas — cada imagem parece viva.\nÉ impossível escolher uma favorita. Adoramos todas.\nA Patricia não é apenas fotógrafa. É uma contadora de histórias, uma presença suave e alguém que se preocupa profundamente com os momentos que está a captar. Se estás a pensar em trabalhar com ela — fá-lo. Vais sentir-te apoiado, inspirado e nas melhores mãos.\nPatricia, obrigada do fundo do coração. Nunca esqueceremos esta experiência.\nEvgenia & Symeon",
      de: "Schon ab der ersten Nachricht wusste ich, dass ich bei Patricia in den besten Händen war. Sie war unglaublich professionell, freundlich, reaktionsschnell und detailverliebt, als sie mir half, meinen Überraschungsantrag in Lissabon zu planen — noch bevor wir uns persönlich getroffen hatten. Sie schlug Locations vor, erklärte alles klar und sorgte dafür, dass wir uns auf jedem Schritt sicher und entspannt fühlten.\nUnd dann… kam der Tag, und es regnete. Aber Patricia hat daraus pure Magie gemacht.\nSie und ihre wunderbare Assistentin schufen eine ruhige, unterstützende und wunderschöne Atmosphäre, in der wir einfach wir selbst sein konnten — und sie haben jedes emotionale Detail unseres Antrags mit Anmut, Wärme und so viel Talent eingefangen. Die Fotos sind atemberaubend. Romantisch, menschlich, lebendig, intim — jedes Bild wirkt lebendig.\nEs ist unmöglich, einen Favoriten zu wählen. Wir lieben jedes einzelne.\nPatricia ist nicht nur eine Fotografin. Sie ist eine Geschichtenerzählerin, eine sanfte Präsenz und jemand, der sich zutiefst um die Momente kümmert, die sie einfängt. Wenn du überlegst, mit ihr zu arbeiten — tu es. Du wirst dich begleitet, inspiriert und bestens aufgehoben fühlen.\nPatricia, danke aus tiefstem Herzen. Wir werden diese Erfahrung nie vergessen.\nEvgenia & Symeon",
      es: "Desde el primer mensaje supe que estaba en las mejores manos con Patricia. Fue increíblemente profesional, amable, atenta y muy detallista ayudándome a planear mi propuesta de matrimonio sorpresa en Lisboa — incluso antes de conocernos en persona. Me sugirió lugares, me explicó la logística con claridad y se aseguró de que nos sintiéramos seguros y relajados en cada paso.\nY entonces… llegó el día, y llovió. Pero Patricia lo convirtió en magia.\nElla y su maravillosa asistente crearon un ambiente tranquilo, cariñoso y precioso, donde simplemente pudimos ser nosotros mismos — y, de alguna manera, captaron cada detalle emocional de nuestra pedida con gracia, calidez y muchísimo talento. Las fotos son impresionantes. Románticas, humanas, vívidas, íntimas — cada imagen parece viva.\nEs imposible elegir una favorita. Nos encantan todas.\nPatricia no es solo una fotógrafa. Es una contadora de historias, una presencia suave y alguien a quien le importan profundamente los momentos que está capturando. Si estás pensando en trabajar con ella — hazlo. Te sentirás apoyado, inspirado y en las mejores manos.\nPatricia, gracias desde el fondo de nuestro corazón. Nunca olvidaremos esta experiencia.\nEvgenia & Symeon",
      fr: "Dès le premier message, j'ai su que j'étais entre les meilleures mains avec Patricia. Elle a été incroyablement professionnelle, gentille, réactive et minutieuse pour m'aider à organiser ma demande en mariage surprise à Lisbonne — avant même que nous nous rencontrions en personne. Elle a proposé des lieux, expliqué clairement la logistique et fait en sorte que nous nous sentions confiants et détendus à chaque étape.\nEt puis… le jour est arrivé, et il a plu. Mais Patricia a tout transformé en magie.\nElle et sa merveilleuse assistante ont créé une atmosphère calme, bienveillante et magnifique, où nous avons simplement pu être nous-mêmes — et, d'une manière ou d'une autre, elles ont capturé chaque détail émotionnel de notre demande avec grâce, chaleur et énormément de talent. Les photos sont magnifiques. Romantiques, humaines, vives, intimes — chaque image semble vivante.\nIl est impossible d'en choisir une préférée. Nous les aimons toutes.\nPatricia n'est pas seulement une photographe. C'est une conteuse, une présence douce, et quelqu'un qui se soucie profondément des moments qu'elle capture. Si tu envisages de travailler avec elle — fais-le. Tu te sentiras soutenu·e, inspiré·e, entre les meilleures mains.\nPatricia, merci du fond du cœur. Nous n'oublierons jamais cette expérience.\nEvgenia & Symeon",
    },
  },
  {
    id: "75ee8df5-48ba-4e28-83d9-cda5c1252cb2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Viktoriia foi excelente! Muito rápida e ágil, o que ajudou a conseguirmos ótimas fotos mesmo nas horas de maior movimento na cidade. Foi também muito divertida e simpática, por isso, se não estás habituado a ser fotografado, ela vai fazer com que te sintas mais confortável.",
      de: "Viktoriia war großartig! Sehr schnell und flink, was sehr hilfreich war, um auch zu Stoßzeiten in der Stadt tolle Fotos zu bekommen. Sie war außerdem sehr lustig und freundlich — wenn du also nicht ans Fotografiertwerden gewöhnt bist, wirst du dich bei ihr sofort wohler fühlen.",
      es: "¡Viktoriia fue genial! Muy rápida y ágil, lo que ayudó muchísimo a conseguir buenas fotos incluso en las horas punta de la ciudad. Además fue muy divertida y simpática, así que si no estás acostumbrado a posar, hará que te sientas más cómodo.",
      fr: "Viktoriia a été superbe ! Très rapide et agile, ce qui a beaucoup aidé pour obtenir de superbes photos même aux heures de pointe en ville. Elle est aussi très drôle et sympathique, donc si vous n'êtes pas habitué à être photographié, elle vous mettra à l'aise.",
    },
  },
  {
    id: "21f08403-56e7-4109-8c5f-91b3ccb95a07",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Procurámos os serviços do Ricardo para captar os melhores momentos do batizado da nossa filha e estamos muito gratos pelo profissionalismo, simpatia, disponibilidade, qualidade e rapidez que demonstrou. Recomendamos vivamente ☺️",
      de: "Wir haben Ricardos Dienste in Anspruch genommen, um die schönsten Momente der Taufe unserer Tochter festzuhalten, und sind sehr dankbar für die Professionalität, Freundlichkeit, Verfügbarkeit, Qualität und Schnelligkeit, die er gezeigt hat. Sehr zu empfehlen ☺️",
      es: "Buscamos los servicios de Ricardo para captar los mejores momentos del bautizo de nuestra hija y estamos muy agradecidos por la profesionalidad, simpatía, disponibilidad, calidad y rapidez que demostró. Lo recomendamos muchísimo ☺️",
      fr: "Nous avons fait appel aux services de Ricardo pour immortaliser les plus beaux moments du baptême de notre fille et nous lui sommes très reconnaissants pour le professionnalisme, la gentillesse, la disponibilité, la qualité et la rapidité dont il a fait preuve. Vivement recommandé ☺️",
    },
  },
  {
    id: "c4c7fe9c-c15e-45ab-818f-47355df8b269",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratámos o Ricardo para captar dois momentos muito especiais das nossas vidas: o nosso casamento e o batizado do nosso filho. Desde o primeiro contacto foi extremamente profissional, atento e organizado. A comunicação foi sempre clara e fez com que nos sentíssemos muito à vontade durante as sessões, o que fez toda a diferença no resultado final. As fotos ficaram simplesmente incríveis, captando toda a emoção e beleza dos momentos com sensibilidade e olhar artístico. A entrega foi rápida e muito bem apresentada, com grande cuidado em cada detalhe. Estamos extremamente satisfeitos e gratos pelo trabalho 😃",
      de: "Wir haben Ricardo engagiert, um zwei sehr besondere Momente unseres Lebens festzuhalten: unsere Hochzeit und die Taufe unseres Sohnes. Vom ersten Kontakt an war er extrem professionell, aufmerksam und organisiert. Die Kommunikation war stets klar und er hat dafür gesorgt, dass wir uns während der Shootings sehr wohlfühlten — das hat den entscheidenden Unterschied im Endergebnis gemacht. Die Fotos sind einfach unglaublich geworden und fangen die Emotion und Schönheit der Momente mit Feingefühl und künstlerischem Blick ein. Die Lieferung war schnell und sehr schön präsentiert, mit großer Sorgfalt in jedem Detail. Wir sind extrem zufrieden und dankbar für die Arbeit 😃",
      es: "Contratamos a Ricardo para captar dos momentos muy especiales de nuestras vidas: nuestra boda y el bautizo de nuestro hijo. Desde el primer contacto fue extremadamente profesional, atento y organizado. La comunicación siempre fue clara y nos hizo sentir muy cómodos durante las sesiones, lo que marcó toda la diferencia en el resultado final. Las fotos quedaron simplemente increíbles, captando toda la emoción y la belleza de los momentos con sensibilidad y ojo artístico. La entrega fue rápida y muy bien presentada, con mucho cuidado en cada detalle. Estamos extremadamente satisfechos y agradecidos por el trabajo 😃",
      fr: "Nous avons engagé Ricardo pour capturer deux moments très spéciaux de notre vie : notre mariage et le baptême de notre fils. Dès le premier contact, il a été extrêmement professionnel, attentif et organisé. La communication a toujours été claire et il nous a mis très à l'aise pendant les séances, ce qui a fait toute la différence sur le résultat final. Les photos sont tout simplement incroyables, elles capturent toute l'émotion et la beauté des moments avec sensibilité et un véritable œil artistique. La livraison a été rapide et très bien présentée, avec un grand soin pour chaque détail. Nous sommes extrêmement satisfaits et reconnaissants pour ce travail 😃",
    },
  },
  {
    id: "d7d67fe9-09eb-4755-af75-c898d8ed015d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalho fantástico. No dia do serviço foi pontual, ganhou a confiança da criança e tirou ótimas fotos. Captou também vários momentos lindos sem ser notado, o que, na minha opinião, tornou o serviço ainda melhor.",
      de: "Fantastische Arbeit. Am Tag des Termins war er pünktlich, hat das Vertrauen des Kindes gewonnen und tolle Fotos gemacht. Er hat außerdem mehrere wunderschöne Momente eingefangen, ohne bemerkt zu werden, was den Auftrag aus meiner Sicht noch besser gemacht hat.",
      es: "Trabajo fantástico. El día del servicio fue puntual, se ganó la confianza del niño e hizo unas fotos geniales. Además captó varios momentos preciosos sin que nos diéramos cuenta, lo cual, en mi opinión, hizo que el servicio fuera todavía mejor.",
      fr: "Travail fantastique. Le jour de la prestation, il était ponctuel, a gagné la confiance de l'enfant et a fait de superbes photos. Il a également capturé plusieurs beaux moments sans se faire remarquer, ce qui, à mon avis, a rendu la prestation encore meilleure.",
    },
  },
  {
    id: "a38f705e-6b55-444e-bebd-3a2966707cd9",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fiquei muito feliz com o trabalho fotográfico — a alegria, o entusiasmo, o empenho e o profissionalismo contribuíram enormemente para o resultado final, que ficou magnífico. Adorei e espero poder fazer parte de mais projetos em breve.",
      de: "Ich war sehr glücklich mit der fotografischen Arbeit — die Freude, der Enthusiasmus, das Engagement und die Professionalität haben enorm zum Endergebnis beigetragen, das großartig geworden ist. Ich war begeistert und hoffe, bald an weiteren Projekten teilnehmen zu können.",
      es: "Quedé muy contenta con el trabajo fotográfico — la alegría, el entusiasmo, la dedicación y la profesionalidad contribuyeron enormemente al resultado final, que fue magnífico. Me encantó y espero poder formar parte de más proyectos pronto.",
      fr: "J'ai été très heureuse du travail photographique — la joie, l'enthousiasme, l'engagement et le professionnalisme ont énormément contribué au résultat final, qui est magnifique. J'ai adoré et j'espère pouvoir participer à d'autres projets bientôt.",
    },
  },
  {
    id: "638f70fc-770f-4fdb-a002-da69fc71e474",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ser fotografada foi uma experiência completamente nova para mim. Aprendi a olhar para a fotografia de outra perspetiva. Para alguém que não gostava lá muito de fotos, descobri que afinal não era assim tão mau — há uma vontade real, no trabalho dele, de fazer sair a naturalidade. Parabéns ao profissional, José Santos.",
      de: "Fotografiert zu werden, war für mich eine völlig neue Erfahrung. Ich habe gelernt, Fotografie aus einer anderen Perspektive zu sehen. Für jemanden, der Fotos eigentlich nicht mochte, habe ich entdeckt, dass es gar nicht so schlimm ist — in seiner Arbeit steckt der ehrliche Wille, das Natürliche zum Vorschein zu bringen. Glückwunsch an den Profi, José Santos.",
      es: "Que me hicieran fotos fue una experiencia completamente nueva para mí. Aprendí a ver la fotografía desde otra perspectiva. Para alguien a quien no le gustaban mucho las fotos, descubrí que en realidad no era tan malo: en su trabajo hay una verdadera intención de hacer aflorar la naturalidad. ¡Felicidades al profesional, José Santos!",
      fr: "Être photographiée a été pour moi une expérience entièrement nouvelle. J'ai appris à voir la photographie sous un autre angle. Pour quelqu'un qui n'aimait pas vraiment les photos, j'ai découvert que ce n'était finalement pas si mal — il y a, dans son travail, une vraie volonté de faire ressortir le naturel. Félicitations au professionnel, José Santos.",
    },
  },
  {
    id: "d184725d-fbd6-4bd8-84b3-41e6435627e1",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui foi o fotógrafo do nosso casamento e do batizado do meu filho. Antes e depois fizemos sessões de Natal. É absolutamente 5 estrelas — recomendo a 100%. Capta expressões e momentos com tanta leveza... É perfeito tanto para quem gosta de ser fotografado como para quem não gosta! Tenho fotos incríveis de um dos dias mais felizes da minha vida. Para concluir: é um excelente profissional e uma pessoa muito prestável.",
      de: "Rui war der Fotograf unserer Hochzeit und der Taufe meines Sohnes. Vor und nach den Hochzeitsterminen haben wir Weihnachts-Shootings gemacht. Er ist absolut 5 Sterne — ich empfehle ihn zu 100 %. Er fängt Ausdrücke und Momente mit so viel Leichtigkeit ein… Er ist perfekt sowohl für die, die gerne fotografiert werden, als auch für die, die es eigentlich nicht mögen! Ich habe unglaubliche Fotos von einem der schönsten Tage meines Lebens. Kurz gesagt: ein hervorragender Profi und ein sehr hilfsbereiter Mensch.",
      es: "Rui fue el fotógrafo de nuestra boda y del bautizo de mi hijo. Antes y después hicimos sesiones de Navidad. Es absolutamente 5 estrellas, lo recomiendo al 100%. Capta expresiones y momentos con muchísima ligereza... ¡Es perfecto tanto para quien le gusta que le hagan fotos como para quien no! Tengo unas fotos increíbles de uno de los días más felices de mi vida. En resumen: un excelente profesional y una persona muy amable.",
      fr: "Rui a été le photographe de notre mariage et du baptême de mon fils. Avant et après, nous avons fait des séances de Noël. Il est absolument 5 étoiles, je le recommande à 100 %. Il capture les expressions et les moments avec tellement de légèreté... Il est parfait aussi bien pour ceux qui aiment être photographiés que pour ceux qui n'aiment pas ! J'ai des photos incroyables de l'un des plus beaux jours de ma vie. En conclusion : un excellent professionnel et une personne très serviable.",
    },
  },
  {
    id: "7c6457e5-020c-4c87-9b64-5c4ea4904345",
    title: {
      pt: "Profissional incrível",
      de: "Unglaubliche Profi",
      es: "Profesional increíble",
      fr: "Professionnelle incroyable",
    },
    text: {
      pt: "Sem dúvida a nossa melhor escolha! A Jennifer não é só uma pessoa fantástica, é também uma excelente profissional! Desde o primeiro encontro, foi sempre atenta, prestável e muito simpática. Traz muita calma e leveza ao fotografar, o que torna o momento ainda mais descontraído — e por isso as fotos ficam tão bonitas.\n\nVoltaríamos a escolher a Jennifer sem hesitar 🥰",
      de: "Ohne Zweifel unsere beste Wahl! Jennifer ist nicht nur ein fantastischer Mensch, sondern auch eine hervorragende Profi! Vom ersten Treffen an war sie aufmerksam, hilfsbereit und sehr freundlich. Sie bringt viel Ruhe und Leichtigkeit ins Fotografieren, was den Moment noch entspannter macht — und genau deshalb werden die Fotos so wunderschön.\n\nWir würden Jennifer ohne zu zögern wieder wählen 🥰",
      es: "¡Sin duda nuestra mejor elección! ¡Jennifer no es solo una persona fantástica, también es una excelente profesional! Desde el primer encuentro fue atenta, servicial y muy amable. Aporta mucha calma y ligereza al fotografiar, lo que hace que el momento sea aún más relajado — y por eso las fotos quedan tan bonitas.\n\nVolveríamos a elegir a Jennifer sin dudarlo 🥰",
      fr: "Sans aucun doute notre meilleur choix ! Jennifer n'est pas seulement quelqu'un de fantastique, c'est aussi une excellente professionnelle ! Dès la première rencontre, elle a été attentive, serviable et très sympathique. Elle apporte beaucoup de calme et de légèreté au moment de la prise de vue, ce qui rend tout encore plus décontracté — et c'est pour cela que les photos sont si belles.\n\nNous choisirions Jennifer à nouveau sans hésiter 🥰",
    },
  },
  {
    id: "7c0615bb-9639-48a7-8a5d-0812f736cc97",
    title: {
      pt: "Casamento e batizado",
      de: "Hochzeit und Taufe",
      es: "Boda y bautizo",
      fr: "Mariage et baptême",
    },
    text: {
      pt: "A Jennifer superou todas as nossas expectativas — com olhos atentos, uma simpatia incrível, uma sensibilidade rara e um talento absolutamente singular, captou não apenas imagens, mas emoções, com alma, arte e coração.\n\nNenhum de nós gosta de ser fotografado e acho que o melhor elogio que lhe podemos fazer é dizer que nem sequer nos sentimos a ser fotografados — tudo foi espontâneo e natural.\n\nAs fotos estão simplesmente deslumbrantes e vamos guardá-las para sempre. Estaremos eternamente gratos pela forma bonita e artística como eternizou o nosso casamento.\n\nRecomendamos vivamente!",
      de: "Jennifer hat all unsere Erwartungen übertroffen — mit aufmerksamen Augen, unglaublicher Freundlichkeit, einer seltenen Sensibilität und einem absolut einzigartigen Talent hat sie nicht nur Bilder, sondern Emotionen eingefangen, mit Seele, Kunst und Herz.\n\nKeiner von uns lässt sich gerne fotografieren, und ich glaube, das beste Kompliment, das wir ihr machen können, ist, dass wir gar nicht das Gefühl hatten, fotografiert zu werden — alles war spontan und natürlich.\n\nDie Fotos sind einfach umwerfend, und wir werden sie für immer in Ehren halten. Wir werden ihr ewig dankbar sein für die schöne und künstlerische Art, wie sie unsere Hochzeit verewigt hat.\n\nSehr zu empfehlen!",
      es: "Jennifer superó todas nuestras expectativas — con una mirada atenta, una simpatía increíble, una sensibilidad poco común y un talento absolutamente único, captó no solo imágenes, sino emociones, con alma, arte y corazón.\n\nA ninguno de nosotros nos gusta que nos hagan fotos, y creo que el mejor cumplido que podemos hacerle es decir que ni siquiera sentimos que nos estaban fotografiando — todo fue espontáneo y natural.\n\nLas fotos son simplemente impresionantes y las guardaremos para siempre. Le estaremos eternamente agradecidos por la forma tan bonita y artística en la que inmortalizó nuestra boda.\n\n¡Muy recomendable!",
      fr: "Jennifer a dépassé toutes nos attentes — avec un regard attentif, une gentillesse incroyable, une sensibilité rare et un talent absolument unique, elle a capturé non seulement des images, mais des émotions, avec âme, art et cœur.\n\nAucun de nous n'aime être photographié, et je crois que le plus beau compliment qu'on puisse lui faire, c'est que nous n'avions même pas l'impression d'être pris en photo — tout était spontané et naturel.\n\nLes photos sont tout simplement magnifiques et nous les garderons à jamais. Nous lui serons éternellement reconnaissants de la façon belle et artistique avec laquelle elle a immortalisé notre mariage.\n\nVivement recommandée !",
    },
  },
  {
    id: "2fe1096b-f787-408f-b508-840a92f64985",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive recentemente uma sessão de retratos profissionais com o fotógrafo Ricardo Moura no estúdio dele. Toda a experiência foi marcada por um profissionalismo e paciência excecionais, garantindo o melhor resultado possível. O Ricardo dedicou tempo a guiar o processo com cuidado e atenção ao detalhe, o que fez toda a diferença. Depois de atualizar o meu perfil do LinkedIn e os sistemas internos da empresa com a imagem final, recebi imensos elogios pela qualidade e profissionalismo do retrato. Estou muito satisfeito com o resultado — obrigado, Ricardo, pelo excelente trabalho. ❤️2",
      de: "Ich hatte kürzlich ein professionelles Porträt-Shooting mit dem Fotografen Ricardo Moura in seinem Studio. Die gesamte Erfahrung war geprägt von außergewöhnlicher Professionalität und Geduld, um das bestmögliche Ergebnis zu sichern. Ricardo hat sich Zeit genommen, den Prozess sorgfältig und mit Liebe zum Detail zu begleiten — das hat den Unterschied gemacht. Nachdem ich mein LinkedIn-Profil und die internen Firmensysteme mit dem finalen Bild aktualisiert habe, bekam ich zahlreiche Komplimente für die Qualität und Professionalität des Porträts. Ich bin sehr zufrieden mit dem Ergebnis — danke, Ricardo, für die hervorragende Arbeit. ❤️2",
      es: "Recientemente tuve una sesión de retratos profesionales con el fotógrafo Ricardo Moura en su estudio. Toda la experiencia estuvo marcada por un profesionalismo y una paciencia excepcionales, asegurando el mejor resultado posible. Ricardo se tomó el tiempo de guiar el proceso con mucho cuidado y atención al detalle, lo que marcó la diferencia. Después de actualizar mi perfil de LinkedIn y los sistemas internos de la empresa con la imagen final, recibí muchísimos elogios por la calidad y la profesionalidad del retrato. Estoy muy contento con el resultado — gracias, Ricardo, por el excelente trabajo. ❤️2",
      fr: "J'ai récemment eu une séance de portraits professionnels avec le photographe Ricardo Moura dans son studio. Toute l'expérience a été marquée par un professionnalisme et une patience exceptionnels, garantissant le meilleur résultat possible. Ricardo a pris le temps de guider le processus avec soin et attention aux détails, ce qui a vraiment fait la différence. Après avoir mis à jour mon profil LinkedIn et les systèmes internes de mon entreprise avec l'image finale, j'ai reçu de nombreux compliments sur la qualité et le professionnalisme du portrait. Je suis très satisfait du résultat — merci Ricardo pour ton excellent travail. ❤️2",
    },
  },
  {
    id: "adba5d22-ae04-4466-9669-4c707f78e1c0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi um prazer ter o Ricardo a captar um momento tão importante como um batizado. Desde o primeiro instante, esteve sempre disponível e atento. No próprio dia foi extremamente pontual. Sempre muito discreto, conseguiu mesmo assim captar momentos únicos com grande naturalidade. A entrega do álbum foi extremamente rápida. Recomendo o trabalho do Ricardo sem dúvida.",
      de: "Es war eine Freude, dass Ricardo einen so wichtigen Moment wie eine Taufe begleitet hat. Vom ersten Moment an war er stets erreichbar und aufmerksam. Am Tag selbst war er extrem pünktlich. Trotz seiner stets sehr dezenten Art hat er es geschafft, einzigartige Momente ganz natürlich einzufangen. Die Übergabe des Albums war ausgesprochen schnell. Ich empfehle Ricardos Arbeit ohne Zweifel.",
      es: "Fue un placer tener a Ricardo captando un momento tan importante como un bautizo. Desde el primer instante estuvo siempre disponible y atento. El propio día fue extremadamente puntual. Siempre muy discreto, aun así consiguió captar momentos únicos con mucha naturalidad. La entrega del álbum fue extremadamente rápida. Recomiendo el trabajo de Ricardo sin ninguna duda.",
      fr: "Ce fut un plaisir d'avoir Ricardo pour immortaliser un moment aussi important qu'un baptême. Dès le premier instant, il a été toujours disponible et attentif. Le jour J, il a été extrêmement ponctuel. Toujours très discret, il a néanmoins su capturer des moments uniques avec beaucoup de naturel. La livraison de l'album a été extrêmement rapide. Je recommande sans aucun doute le travail de Ricardo.",
    },
  },
  {
    id: "58970448-a135-46e9-8110-0b75c7ae83f4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive uma sessão de fotografia para fins profissionais e fiquei muito impressionado com a qualidade das instalações e do equipamento. O Ricardo deu-me dicas para alcançar os resultados que queria e foi paciente durante todo o processo.",
      de: "Ich hatte ein Foto-Shooting für berufliche Zwecke und war von der Qualität der Räumlichkeiten und der Ausrüstung sehr beeindruckt. Ricardo hat mir Tipps gegeben, um die gewünschten Ergebnisse zu erzielen, und war während des gesamten Prozesses sehr geduldig.",
      es: "Tuve una sesión de fotografía con fines profesionales y me quedé muy impresionado con la calidad de las instalaciones y del equipamiento. Ricardo me dio consejos para conseguir los resultados que quería y fue paciente durante todo el proceso.",
      fr: "J'ai fait une séance photo à des fins professionnelles et j'ai été très impressionné par la qualité des installations et du matériel. Ricardo m'a donné des conseils pour obtenir les résultats que je voulais et a été patient tout au long du processus.",
    },
  },
  {
    id: "c85527c8-300c-44a7-83ec-b3eef1d746bf",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Ricardo é um excelente fotógrafo. Tive uma sessão profissional em estúdio com ele e fiquei muito satisfeito com o resultado, mas sobretudo com a forma atenciosa e eficiente como decorreu o processo. Recomendo.",
      de: "Ricardo ist ein hervorragender Fotograf. Ich hatte ein professionelles Studio-Shooting mit ihm und war mit dem Ergebnis sehr zufrieden, aber vor allem mit der aufmerksamen und effizienten Art, in der der Prozess abgelaufen ist. Sehr zu empfehlen.",
      es: "Ricardo es un excelente fotógrafo. Tuve una sesión profesional en estudio con él y quedé muy satisfecho con el resultado, pero sobre todo con la forma atenta y eficiente en la que se desarrolló el proceso. Lo recomiendo.",
      fr: "Ricardo est un excellent photographe. J'ai fait une séance professionnelle en studio avec lui et j'ai été très satisfait du résultat, mais surtout de la manière attentive et efficace dont le processus s'est déroulé. Je le recommande.",
    },
  },
  {
    id: "0eac3832-013f-4720-8ca1-b6c83448c973",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Escolhi o Ricardo para fotografar o batizado da minha filha. O resultado final foi excelente e o tempo de entrega foi super rápido!",
      de: "Ich habe Ricardo ausgewählt, um die Taufe meiner Tochter zu fotografieren. Das Endergebnis war hervorragend und die Lieferzeit superschnell!",
      es: "Elegí a Ricardo para fotografiar el bautizo de mi hija. El resultado final fue excelente y el tiempo de entrega ¡súper rápido!",
      fr: "J'ai choisi Ricardo pour photographier le baptême de ma fille. Le résultat final était excellent et le délai de livraison super rapide !",
    },
  },
  {
    id: "6154ef45-1dbc-4d4f-ba2e-e50d2eb89150",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalho incrível, super profissional. Destaco a clareza do serviço prestado e a rapidez na entrega. Recomendo vivamente!!",
      de: "Großartige Arbeit, sehr professionell. Besonders hervorzuheben sind die Klarheit der Dienstleistung und die schnelle Lieferung. Sehr zu empfehlen!!",
      es: "¡Trabajo increíble, súper profesional. Destaco la claridad del servicio prestado y la rapidez en la entrega. Lo recomiendo muchísimo!!",
      fr: "Un travail incroyable, super professionnel. Je salue la clarté de la prestation et la rapidité de livraison. Je recommande vivement !!",
    },
  },
  {
    id: "802316cc-543b-42d0-9ec3-21db37024f8c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Quero agradecer pelo excelente trabalho, desde a forma como tirou as fotos até ao álbum incrível que fez. Tudo ficou espetacular — foi um dia inesquecível que será recordado para sempre através das suas fotos magníficas.",
      de: "Ich möchte mich für die hervorragende Arbeit bedanken — von der Art, wie die Fotos gemacht wurden, bis hin zum unglaublichen Album. Alles ist spektakulär geworden — ein unvergesslicher Tag, an den man sich dank Ihrer wunderbaren Fotos für immer erinnern wird.",
      es: "Quiero darte las gracias por el excelente trabajo, desde la forma en la que hiciste las fotos hasta el álbum increíble que hiciste. Todo quedó espectacular: fue un día inolvidable que se recordará para siempre a través de tus magníficas fotos.",
      fr: "Je tiens à vous remercier pour l'excellent travail, depuis la façon dont vous avez pris les photos jusqu'à l'incroyable album que vous avez réalisé. Tout est devenu spectaculaire — une journée inoubliable dont on se souviendra toujours grâce à vos magnifiques photos.",
    },
  },
  {
    id: "e7391891-bbbd-4e8d-861f-d1ea48021860",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O José é um dos fotógrafos mais profissionais e fiáveis com quem já tivemos o prazer de trabalhar. Faz não só um trabalho incrível a captar momentos inspiradores, como o faz com muito entusiasmo. As nossas fotos finais editadas foram entregues muito rapidamente, com o que ficámos muito satisfeitos, e fez um trabalho lindíssimo. O José é honesto, muito profissional e um artista extremamente talentoso! Recomendo-o a quem procure um trabalho fotográfico profissional. Mais uma vez obrigada, José.",
      de: "José ist einer der professionellsten und zuverlässigsten Fotografen, mit denen wir je arbeiten durften. Er fängt nicht nur inspirierende Momente unglaublich gut ein, sondern tut das auch mit großer Begeisterung. Unsere fertig bearbeiteten Fotos haben wir sehr schnell bekommen, was uns sehr gefreut hat — und seine Arbeit ist wunderschön. José ist ehrlich, sehr professionell und ein außergewöhnlich talentierter Künstler! Ich empfehle ihn jedem, der professionelle Fotografie sucht. Nochmals vielen Dank, José.",
      es: "José es uno de los fotógrafos más profesionales y fiables con los que hemos tenido el placer de trabajar. No solo hace un trabajo increíble captando momentos inspiradores, sino que lo hace con mucho entusiasmo. Nuestras fotos finales editadas las recibimos muy rápido, lo que nos alegró mucho, y el resultado es precioso. José es honesto, muy profesional ¡y un artista con muchísimo talento! Lo recomiendo a cualquiera que busque un trabajo fotográfico profesional. Gracias de nuevo, José.",
      fr: "José est l'un des photographes les plus professionnels et fiables avec qui nous avons eu le plaisir de travailler. Non seulement il fait un travail incroyable pour capturer des moments inspirants, mais il le fait avec beaucoup d'enthousiasme. Nos photos finales retouchées nous ont été remises très rapidement, ce dont nous avons été très contents, et le résultat est magnifique. José est honnête, très professionnel et un artiste extrêmement talentueux ! Je le recommande à toute personne cherchant un travail photographique professionnel. Merci encore, José.",
    },
  },
  {
    id: "12a9a235-b309-4777-9ca3-f94bc86895cc",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Desde o primeiro contacto, o Rui demonstrou um profissionalismo e sensibilidade incríveis. Fez-nos sentir totalmente à vontade, captando momentos genuínos e cheios de emoção. A qualidade das fotografias superou todas as nossas expectativas — cada imagem conta uma história. O Rui teve uma presença discreta mas sempre atenta, captando os detalhes mais importantes sem nos apercebermos. A comunicação foi sempre clara e rápida, e a entrega do trabalho final foi pontual e lindamente apresentada. Recomendamos de coração!!!!",
      de: "Vom ersten Kontakt an hat Rui unglaubliche Professionalität und Sensibilität bewiesen. Er hat dafür gesorgt, dass wir uns absolut wohlfühlen, und echte, gefühlvolle Momente eingefangen. Die Qualität der Fotos hat all unsere Erwartungen übertroffen — jedes Bild erzählt eine Geschichte. Rui war dezent, aber immer aufmerksam und hat die wichtigsten Details festgehalten, ohne dass wir es bemerkt haben. Die Kommunikation war stets klar und schnell, und die Übergabe der finalen Arbeit war pünktlich und wunderschön präsentiert. Wir empfehlen ihn von Herzen!!!!",
      es: "Desde el primer contacto, Rui demostró un profesionalismo y una sensibilidad increíbles. Nos hizo sentir totalmente cómodos, captando momentos genuinos y llenos de emoción. La calidad de las fotografías superó todas nuestras expectativas — cada imagen cuenta una historia. Rui tuvo una presencia discreta pero siempre atenta, captando los detalles más importantes sin que nos diéramos cuenta. La comunicación siempre fue clara y rápida, y la entrega del trabajo final fue puntual y muy bien presentada. ¡¡Lo recomendamos de corazón!!",
      fr: "Dès le premier contact, Rui a fait preuve d'un professionnalisme et d'une sensibilité incroyables. Il nous a totalement mis à l'aise, capturant des moments authentiques et pleins d'émotion. La qualité des photographies a dépassé toutes nos attentes — chaque image raconte une histoire. Rui a eu une présence discrète mais toujours attentive, capturant les détails les plus importants sans que nous nous en rendions compte. La communication a toujours été claire et rapide, et la livraison du travail final a été ponctuelle et magnifiquement présentée. Nous recommandons de tout cœur !!!!",
    },
  },
  {
    id: "bc851ced-fa95-4d00-83b2-992a21461f04",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui é um excelente profissional. Já conhecíamos o seu trabalho de alguns batizados na família e agora, no casamento, foi ainda mais incrível. Um profissional tranquilo, simpático, que nos coloca muito à vontade e se preocupa muito com o bem-estar dos protagonistas do dia! As fotos são todas extremamente naturais e captam o mais importante destes dias… a felicidade constante! Gostaríamos de agradecer todo o carinho. Élio e Teresa",
      de: "Rui ist ein hervorragender Profi. Wir kannten seine Arbeit bereits von einigen Taufen in der Familie und jetzt, bei der Hochzeit, war es noch unglaublicher. Ein ruhiger, freundlicher Profi, der uns absolut entspannen lässt und sich sehr um das Wohlbefinden der Hauptpersonen des Tages kümmert! Die Fotos sind alle extrem natürlich und fangen das Wichtigste dieser Tage ein… das ständige Glück! Wir möchten uns für die ganze Zuwendung bedanken. Élio und Teresa",
      es: "Rui es un excelente profesional. Ya conocíamos su trabajo de algunos bautizos en la familia, y ahora en la boda fue aún más increíble. Un profesional tranquilo, simpático, que te pone muy cómodo y se preocupa mucho del bienestar de los protagonistas del día. Las fotos son todas muy naturales y captan lo más importante de estos días: ¡la felicidad constante! Queríamos agradecerle todo el cariño. Élio y Teresa",
      fr: "Rui est un excellent professionnel. Nous connaissions déjà son travail grâce à quelques baptêmes dans la famille et, pour le mariage, ce fut encore plus incroyable. Un professionnel calme, sympathique, qui nous met très à l'aise et se soucie beaucoup du bien-être des protagonistes du jour ! Les photos sont toutes extrêmement naturelles et capturent le plus important de ces journées… le bonheur constant ! Nous tenons à le remercier de toute son attention. Élio et Teresa",
    },
  },
  {
    id: "819bd04b-13d7-47e9-ac70-f919ec2af111",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Experiência incrível — se quiserem ter um profissional do caraças e com uma boa disposição daquelas top, contratem o RUI. Pessoa 10 estrelas, não só pelo seu talento como fotógrafo, mas também enquanto pessoa. Contratámos o Rui para fotografar o nosso casamento e não podíamos estar mais felizes. Sempre disponível e com uma capacidade de captar momentos sem que nos apercebamos. Tivemos ainda o privilégio de fazer uma sessão antes do casamento, e posso dizer que tem fotografias do CARAÇAS 🤩👊 Se querem que os vossos momentos fiquem registados por uma pessoa de confiança, profissional e bem-disposta, contratem este homem. Obrigada por tudo, Rui — estamos muito felizes com a escolha. FILIPA E JOAQUIM 19.7.2025",
      de: "Eine unglaubliche Erfahrung — wenn ihr einen verdammt guten Profi mit einer absolut top Laune wollt, bucht RUI. Ein 10-Sterne-Mensch, nicht nur wegen seines Talents als Fotograf, sondern auch als Mensch. Wir haben Rui für unsere Hochzeitsfotos engagiert und könnten nicht glücklicher sein. Immer erreichbar und mit der Gabe, Momente festzuhalten, ohne dass man es überhaupt bemerkt. Wir hatten außerdem das Vergnügen, vor der Hochzeit ein Shooting zu machen, und ich kann sagen: Er macht WAHNSINNIG gute Fotos 🤩👊 Wenn ihr eure Momente von einem vertrauenswürdigen, professionellen und gutgelaunten Menschen festgehalten haben wollt, dann engagiert diesen Mann. Danke für alles, Rui — wir sind so glücklich mit der Wahl. FILIPA & JOAQUIM 19.7.2025",
      es: "Experiencia increíble — si queréis tener un profesional de la hostia y con una disposición de esas top, contratad a RUI. Persona de 10 estrellas, no solo por su talento como fotógrafo, sino también como persona. Contratamos a Rui para fotografiar nuestra boda y no podríamos estar más contentos. Siempre disponible, y con una capacidad para captar momentos sin que nos demos cuenta. Tuvimos también el privilegio de hacer una sesión antes de la boda, y puedo decir que tiene unas fotografías DE LA HOSTIA 🤩👊 Si queréis que vuestros momentos los registre una persona de confianza, profesional y con buen rollo, contratad a este hombre. Gracias por todo, Rui — estamos muy contentos con la elección. FILIPA Y JOAQUIM 19.7.2025",
      fr: "Une expérience incroyable — si vous voulez un professionnel d'enfer et avec une humeur au top, engagez RUI. Une personne 10 étoiles, non seulement pour son talent de photographe, mais aussi en tant qu'être humain. Nous avons engagé Rui pour photographier notre mariage et nous ne pourrions pas être plus heureux. Toujours disponible, et avec une capacité à capturer des moments sans qu'on s'en aperçoive. Nous avons également eu le privilège de faire une séance avant le mariage, et je peux dire qu'il fait des photos D'ENFER 🤩👊 Si vous voulez que vos moments soient immortalisés par quelqu'un de confiance, professionnel et de bonne humeur, engagez cet homme. Merci pour tout, Rui — nous sommes très heureux de notre choix. FILIPA ET JOAQUIM 19.7.2025",
    },
  },
  {
    id: "827acb7d-0bba-4006-9c80-e4fdade3d39c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei trabalhar com a Viktoriia! Foi simpática e muito flexível, e tornou a sessão muito confortável. Ansiosa por ver as fotos!",
      de: "Es war wunderbar, mit Viktoriia zu arbeiten! Sie war sehr nett und flexibel und hat das Shooting absolut entspannt gemacht. Ich kann es kaum erwarten, die Bilder zu sehen!",
      es: "¡Encantada de trabajar con Viktoriia! Fue muy amable y flexible, e hizo que la sesión fuera muy cómoda. ¡Con muchas ganas de ver las fotos!",
      fr: "Un plaisir de travailler avec Viktoriia ! Elle a été gentille et très flexible, et a rendu la séance très confortable. J'ai hâte de voir les photos !",
    },
  },
  {
    id: "06c2f4c0-5f7f-47dc-b8bf-06a2726aa6e4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Ricardo e a sua equipa foram sempre 5* connosco, especialmente com a nossa filha. Gostámos muito do trabalho que fizeram no batizado da nossa filha. As fotos e a edição do vídeo foram de topo. Desde o primeiro momento que o Ricardo se preocupou em saber o que queríamos e, mesmo depois, esteve sempre disponível para se reunir connosco e responder às nossas dúvidas. Ficámos mesmo muito felizes com o trabalho do Ricardo e da sua equipa. Obrigada por tudo. Cátia e João.",
      de: "Ricardo und sein Team waren immer 5* mit uns, besonders mit unserer Tochter. Uns hat die Arbeit, die sie bei der Taufe unserer Tochter gemacht haben, sehr gefallen. Die Fotos und der Videoschnitt waren erstklassig. Von Anfang an hat sich Ricardo darum gekümmert zu verstehen, was wir wollten, und auch danach war er immer bereit, sich mit uns zu treffen und unsere Fragen zu beantworten. Wir waren mit der Arbeit von Ricardo und seinem Team wirklich sehr zufrieden. Danke für alles. Cátia und João.",
      es: "Ricardo y su equipo siempre fueron de 5* con nosotros, sobre todo con nuestra hija. Nos gustó muchísimo el trabajo que hicieron en el bautizo de nuestra hija. Las fotos y la edición del vídeo fueron de primera. Desde el primer momento Ricardo se preocupó por saber qué queríamos, y también después estuvo siempre disponible para reunirse con nosotros y responder a nuestras dudas. Quedamos realmente muy contentos con el trabajo de Ricardo y su equipo. Gracias por todo. Cátia y João.",
      fr: "Ricardo et son équipe ont toujours été 5* avec nous, particulièrement avec notre fille. Nous avons beaucoup aimé le travail qu'ils ont fait au baptême de notre fille. Les photos et le montage vidéo ont été au top. Dès le premier instant, Ricardo a cherché à comprendre ce que nous voulions et, même après, il a toujours été disponible pour nous rencontrer et répondre à nos questions. Nous avons vraiment été très heureux du travail de Ricardo et de son équipe. Merci pour tout. Cátia et João.",
    },
  },
  {
    id: "3e973011-f13b-41c4-adea-b2a8d4674f1c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive uma experiência fantástica com a Ricardo Moura - Photo & Film. Desde o primeiro contacto, o Ricardo foi extremamente prestável e profissional, fazendo-me sentir completamente à vontade durante a sessão. Ajudou-me a encontrar os melhores ângulos e poses para garantir o resultado mais natural e bonito possível. O resultado final superou todas as expectativas — as fotos ficaram incríveis! Recomendo sem hesitar a quem procura um serviço de fotografia de retratos profissional de alta qualidade.",
      de: "Ich hatte eine fantastische Erfahrung mit Ricardo Moura - Photo & Film. Vom ersten Kontakt an war Ricardo äußerst hilfsbereit und professionell und hat mich während der Session vollkommen entspannen lassen. Er hat mir geholfen, die besten Winkel und Posen zu finden, um das natürlichste und schönste Ergebnis zu erzielen. Das Endergebnis hat alle Erwartungen übertroffen — die Fotos sind unglaublich geworden! Ich empfehle ihn ohne zu zögern jedem, der einen hochwertigen, professionellen Porträt-Fotodienst sucht.",
      es: "Tuve una experiencia fantástica con Ricardo Moura - Photo & Film. Desde el primer contacto, Ricardo fue extremadamente atento y profesional, haciéndome sentir completamente cómodo durante la sesión. Me ayudó a encontrar los mejores ángulos y poses para asegurar el resultado más natural y bonito posible. ¡El resultado final superó todas las expectativas! Las fotos quedaron increíbles. Lo recomiendo sin dudarlo a cualquiera que busque un servicio de fotografía de retrato profesional de alta calidad.",
      fr: "J'ai vécu une expérience fantastique avec Ricardo Moura - Photo & Film. Dès le premier contact, Ricardo a été extrêmement serviable et professionnel, en me mettant complètement à l'aise pendant la séance. Il m'a aidé à trouver les meilleurs angles et poses pour obtenir le résultat le plus naturel et beau possible. Le résultat final a dépassé toutes les attentes — les photos sont incroyables ! Je le recommande sans hésiter à toute personne cherchant un service de photographie de portrait professionnel de haute qualité.",
    },
  },
  {
    id: "8fda12cb-3e21-47a9-b3c1-784fa26e5b49",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Nenhum Photoshop substitui um trabalho de qualidade! O Ricardo fez um excelente trabalho, com rapidez e uma qualidade incrível!! Só posso recomendá-lo, porque ele merece! Parabéns, Ricardo! Bem feito!",
      de: "Kein Photoshop ersetzt gute, hochwertige Arbeit! Ricardo hat einen ausgezeichneten Job gemacht, schnell und in unglaublicher Qualität!! Ich kann ihn nur empfehlen, denn er hat es verdient!! Glückwunsch, Ricardo! Sehr gut gemacht!",
      es: "¡Ningún Photoshop sustituye un buen trabajo de calidad! ¡Ricardo hizo un trabajo excelente, con rapidez y una calidad increíble! Solo puedo recomendarlo porque se lo merece. ¡Felicidades, Ricardo! ¡Muy bien hecho!",
      fr: "Aucun Photoshop ne remplace un bon travail de qualité ! Ricardo a fait un excellent travail, rapidement et avec une qualité incroyable !! Je ne peux que le recommander, parce qu'il le mérite ! Bravo Ricardo ! Bien joué !",
    },
  },
  {
    id: "5b50d041-8529-445f-8caa-b0888bc2ca76",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Bom dia, Sr. José Santos. Foi um grande prazer participar na montagem do seu estúdio fotográfico — uma experiência enriquecedora para mim, pessoalmente. Dou os meus parabéns pela sua dedicação à arte da fotografia. Coloca sempre todo o esforço e profissionalismo em cada projeto que abraça. Aconselho toda a gente a visitar o seu estúdio — de certeza que não sairão desiludidos.",
      de: "Guten Tag, Herr José Santos. Es war mir eine große Freude, beim Aufbau Ihres Fotostudios mitzuwirken — eine bereichernde Erfahrung für mich persönlich. Ich beglückwünsche Sie zu Ihrer Hingabe an die Kunst der Fotografie. Sie investieren in jedes Projekt, das Sie übernehmen, vollen Einsatz und Professionalität. Ich rate jedem, Ihr Studio zu besuchen — ganz sicher wird niemand enttäuscht nach Hause gehen.",
      es: "Buenos días, Sr. José Santos. Fue un gran placer participar en el montaje de su estudio fotográfico — una experiencia enriquecedora para mí personalmente. Le felicito por su dedicación al arte de la fotografía. Pone siempre todo el esfuerzo y profesionalidad en cada proyecto que asume. Recomiendo a todo el mundo visitar su estudio — seguro que no salen decepcionados.",
      fr: "Bonjour, Monsieur José Santos. Cela a été un grand plaisir de participer à l'installation de votre studio photo — une expérience enrichissante pour moi personnellement. Je vous félicite pour votre dévouement à l'art de la photographie. Vous mettez toujours tous vos efforts et votre professionnalisme dans chaque projet que vous entreprenez. Je conseille à tout le monde de visiter votre studio — vous n'en repartirez certainement pas déçus.",
    },
  },
  {
    id: "84e4f22a-6b48-465d-9dc7-ad1b8c43c252",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei o resultado da sessão — todas as fotos estão lindas, o que torna difícil escolher quais emoldurar. Muito obrigada pela disponibilidade e profissionalismo.",
      de: "Ich liebe das Ergebnis des Shootings — alle Fotos sind wunderschön, was es schwer macht, sich zu entscheiden, welche man rahmen soll. Vielen Dank für die Verfügbarkeit und Professionalität.",
      es: "Me encantó el resultado de la sesión — todas las fotos están preciosas, lo que hace difícil elegir cuáles enmarcar. Muchas gracias por la disponibilidad y la profesionalidad.",
      fr: "J'ai adoré le résultat de la séance — toutes les photos sont magnifiques, ce qui rend difficile le choix de celles à encadrer. Merci beaucoup pour la disponibilité et le professionnalisme.",
    },
  },
  {
    id: "e9cb4f3a-b047-47ce-b99a-c2a4fc4bffc0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A minha experiência com a Chris foi simplesmente maravilhosa! É uma profissional extremamente talentosa, criativa e dedicada. Desde o primeiro contacto, demonstrou uma grande atenção ao detalhe e uma sensibilidade única. O resultado final superou todas as minhas expectativas, com fotos lindas, naturais e cheias de personalidade. Recomendo de coração a quem procura uma fotógrafa de confiança, carismática e verdadeiramente dedicada a entregar o melhor trabalho. Vou de certeza voltar a contratar os seus serviços no futuro!",
      de: "Meine Erfahrung mit Chris war einfach wunderbar! Sie ist eine extrem talentierte, kreative und engagierte Profi. Vom ersten Kontakt an hat sie große Liebe zum Detail und eine einzigartige Sensibilität gezeigt. Das Endergebnis hat all meine Erwartungen übertroffen — wunderschöne, natürliche Fotos voller Persönlichkeit. Ich empfehle sie von Herzen jedem, der eine vertrauenswürdige, charismatische Fotografin sucht, die wirklich alles dafür tut, das beste Ergebnis zu liefern. Ich werde ihre Dienste in Zukunft ganz sicher wieder in Anspruch nehmen!",
      es: "Mi experiencia con Chris fue, sencillamente, maravillosa. Es una profesional extremadamente talentosa, creativa y dedicada. Desde el primer contacto demostró una gran atención al detalle y una sensibilidad única. El resultado final superó todas mis expectativas, con fotos preciosas, naturales y llenas de personalidad. La recomiendo de corazón a quien busque una fotógrafa de confianza, carismática y de verdad dedicada a entregar el mejor trabajo. ¡Volveré sin duda a contratarla en el futuro!",
      fr: "Mon expérience avec Chris a tout simplement été merveilleuse ! C'est une professionnelle extrêmement talentueuse, créative et dévouée. Dès le premier contact, elle a fait preuve d'une grande attention aux détails et d'une sensibilité unique. Le résultat final a dépassé toutes mes attentes, avec des photos magnifiques, naturelles et pleines de personnalité. Je la recommande de tout cœur à toute personne cherchant une photographe de confiance, charismatique et vraiment dévouée à livrer le meilleur travail possible. Je ferai sans aucun doute appel à ses services à l'avenir !",
    },
  },
  {
    id: "bf1dfb0c-fbf1-449c-99b2-5d185185f055",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Quero dizer que todas as fotos que recebi são incríveis! 📸 Cada plano é como uma obra de arte: vivo, caloroso, cheio de atmosfera e emoção. Sente-se mesmo o profissionalismo, o gosto refinado e a capacidade de captar os momentos mais sinceros. Trabalhar com a Masha é um prazer — é fácil, confortável, com a sensação de que somos verdadeiramente vistos e compreendidos. Apetece-me olhar para as fotos vezes sem conta — são tão bonitas e \"vivas\". Obrigada pelo teu talento e pela alma que pões no teu trabalho! Já estou a sonhar com mais sessões juntas 💕",
      de: "Ich möchte sagen, dass alle Fotos, die ich erhalten habe, unglaublich sind! 📸 Jede Aufnahme ist wie ein Kunstwerk: lebendig, warm, voller Atmosphäre und Emotion. Man spürt einfach die Professionalität, den feinen Geschmack und die Fähigkeit, die ehrlichsten Momente einzufangen. Mit Masha zu arbeiten ist ein Vergnügen — es ist einfach, angenehm, mit dem Gefühl, wirklich gesehen und verstanden zu werden. Ich möchte die Fotos immer wieder anschauen — so schön und „lebendig\" sind sie. Danke für dein Talent und die Seele, die du in deine Arbeit legst! Ich träume schon von weiteren gemeinsamen Sessions 💕",
      es: "Quiero decir que todas las fotos que recibí son increíbles! 📸 Cada toma es como una obra de arte: viva, cálida, llena de atmósfera y emoción. Se siente realmente el profesionalismo, el gusto refinado y la capacidad de captar los momentos más sinceros. Trabajar con Masha es un placer — es fácil, cómodo, con la sensación de que te ven y te entienden de verdad. Me apetece mirar las fotos una y otra vez — son tan bonitas y \"vivas\". ¡Gracias por tu talento y por el alma que pones en tu trabajo! Ya estoy soñando con más sesiones juntas 💕",
      fr: "Je veux dire que toutes les photos que j'ai reçues sont incroyables ! 📸 Chaque cliché est comme une œuvre d'art : vivant, chaleureux, plein d'atmosphère et d'émotion. On y ressent vraiment le professionnalisme, le goût raffiné et la capacité de capter les moments les plus sincères. Travailler avec Masha est un plaisir — c'est facile, confortable, avec la sensation d'être vraiment vue et comprise. J'ai envie de regarder les photos encore et encore — elles sont si belles et si \"vivantes\". Merci pour ton talent et pour l'âme que tu mets dans ton travail ! Je rêve déjà d'autres séances ensemble 💕",
    },
  },
  {
    id: "b6049667-030b-4f73-8da3-6b3a40ef332f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Para quem quiser trazer recordações agradáveis de Portugal sob a forma de fotografias profissionais — não vais encontrar melhor fotógrafa e super profissional do que a Maria! Recomendo a 100%!",
      de: "Wer schöne Erinnerungen aus Portugal in Form professioneller Fotos mit nach Hause nehmen möchte, wird keine bessere Fotografin und keine kompetentere Profi finden als Maria! Absolute Empfehlung!",
      es: "Para quien quiera traerse recuerdos bonitos de Portugal en forma de fotografías profesionales — no vas a encontrar mejor fotógrafa y mejor profesional que Maria. ¡La recomiendo al 100%!",
      fr: "Pour celles et ceux qui veulent ramener de jolis souvenirs du Portugal sous forme de photos professionnelles — vous ne trouverez pas meilleure photographe et plus grande pro que Maria ! Je la recommande à 100 % !",
    },
  },
  {
    id: "b2ee5eee-5bde-43e1-8001-d914425b9938",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Pela sua lente vemos o mundo de uma forma nova. Ela apanha a luz como se estivesse a conversar com ela. Transmite emoção de uma forma que faz com que cada foto pareça viva — encantam, tocam, inspiram. O trabalho da Maria não são apenas imagens: são memórias, são histórias, é arte verdadeira. Do fundo do coração, obrigada, Maria, por me mostrares o mundo de uma forma que provavelmente não teria visto sem ti. Adorei conhecer-te e ganhei uma nova experiência.",
      de: "Durch ihr Objektiv sehen wir die Welt auf eine neue Weise. Sie fängt das Licht ein, als würde sie ein Gespräch mit ihm führen. Sie überträgt Emotionen so, dass jedes Foto lebendig wirkt — sie verzaubern, berühren, inspirieren. Marias Arbeit besteht nicht nur aus Bildern: Es sind Erinnerungen, Geschichten, echte Kunst. Aus tiefstem Herzen danke ich dir, Maria, dass du mir die Welt auf eine Weise gezeigt hast, die ich ohne dich vermutlich nie gesehen hätte. Ich habe es geliebt, dich kennenzulernen, und habe eine neue Erfahrung gewonnen.",
      es: "A través de su lente vemos el mundo de una forma nueva. Atrapa la luz como si estuviera conversando con ella. Transmite emoción de tal manera que cada foto parece estar viva — encantan, tocan, inspiran. El trabajo de Maria no son solo imágenes: son recuerdos, son historias, es arte de verdad. Desde el fondo del corazón, gracias, Maria, por mostrarme el mundo de una manera que probablemente no habría visto sin ti. Me encantó conocerte y me llevo una nueva experiencia.",
      fr: "À travers son objectif, nous voyons le monde d'une nouvelle façon. Elle capte la lumière comme si elle conversait avec elle. Elle transmet l'émotion de manière à ce que chaque photo semble vivante — elles enchantent, touchent, inspirent. Le travail de Maria, ce ne sont pas seulement des images : ce sont des souvenirs, des histoires, du véritable art. Du fond du cœur, merci, Maria, de m'avoir montré le monde d'une manière que je n'aurais probablement pas vue sans toi. J'ai adoré te rencontrer et j'en repars avec une nouvelle expérience.",
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
console.log(`\nBatch rev-3 done — ${REV.length} reviews translated.`);
